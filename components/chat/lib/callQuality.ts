/**
 * How good a call's connection is, and how much video it can carry, from real WebRTC statistics.
 * Nothing in here touches the DOM or a peer connection: it only reads plain `getStats()` entries, so
 * every rule below can be tested without a browser.
 *
 *   QualitySampler   two consecutive `getStats()` snapshots in, one readable sample out (bitrate, loss, RTT, fps...)
 *   QualityMeter     samples in, a steady level for the signal indicator out (quick to warn, slow to cheer up)
 *   VideoGovernor    samples in, the video tier to send out (steps down fast, climbs back slowly, can pause video)
 *
 * The browser's own congestion control still decides how much it really sends. The governor only sets the
 * ceiling (resolution, frame rate, bitrate) so a weak link gets a smaller, steadier picture instead of a
 * stuttering big one, and so audio is never starved by video.
 */

/* -------------------------------------------------------------------------------------------------
 * What a sample says
 * ---------------------------------------------------------------------------------------------- */

export type QualityLevel = "excellent" | "good" | "fair" | "poor" | "lost";

export const QUALITY_LABEL: Record<QualityLevel, string> = {
    excellent: "Excellent",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
    lost: "No connection",
};

export interface VideoPicture {
    width: number;
    height: number;
    fps: number;
}

/** Why the browser is encoding less than it could. */
export type QualityLimit = "none" | "bandwidth" | "cpu" | "other";

export interface QualitySample {
    rttMs: number | null;
    jitterMs: number | null;
    /** Share of packets lost over the last interval, 0 to 1 (the worse of the two directions). */
    loss: number | null;
    sendKbps: number;
    receiveKbps: number;
    /** What the browser estimates the uplink can carry; null when it doesn't say. */
    availableSendKbps: number | null;
    /** The picture being sent / received right now; null when there is no moving video that way. */
    sent: VideoPicture | null;
    received: VideoPicture | null;
    limit: QualityLimit;
    /** Video keeps arriving but the picture isn't moving. */
    frozen: boolean;
    /** Nothing at all arrived during the last interval. */
    silent: boolean;
    /** The media goes through a TURN relay instead of straight between the two browsers. */
    relayed: boolean | null;
}

/** What the call screen shows. */
export interface ConnectionQuality {
    level: QualityLevel;
    /** 0 to 100, smoothed. */
    score: number;
    sample: QualitySample;
    /** The video this browser sends; null for a voice call or while the camera is off. */
    sending: { tier: VideoTierId; paused: boolean; reduced: boolean } | null;
}

/* -------------------------------------------------------------------------------------------------
 * Reading getStats()
 * ---------------------------------------------------------------------------------------------- */

type Stat = Record<string, unknown>;

const finite = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const kindOf = (stat: Stat): string | undefined => {
    const kind = stat.kind ?? stat.mediaType; // older browsers say `mediaType`
    return typeof kind === "string" ? kind : undefined;
};
const idOf = (stat: Stat): string => (typeof stat.id === "string" ? stat.id : `${String(stat.type)}:${String(stat.ssrc ?? "")}`);

/** The candidate pair the media is using. */
function selectedPair(pairs: Stat[], transports: Stat[]): Stat | undefined {
    for (const transport of transports) {
        const id = transport.selectedCandidatePairId;
        const pair = typeof id === "string" ? pairs.find((candidate) => candidate.id === id) : undefined;
        if (pair) return pair;
    }
    return (
        pairs.find((pair) => pair.selected === true) ??
        pairs.find((pair) => pair.nominated === true && pair.state === "succeeded") ??
        pairs.find((pair) => pair.state === "succeeded")
    );
}

/**
 * Turns snapshots into samples. Counters only ever grow, so everything per second is the difference
 * between this snapshot and the previous one.
 */
export class QualitySampler {
    private counters = new Map<string, Record<string, number>>();
    private at: number | null = null;

    reset() {
        this.counters = new Map();
        this.at = null;
    }

    /** `stats` is everything `getStats()` returned; `now` is when it was taken, in milliseconds. */
    sample(stats: Iterable<Stat>, now: number): QualitySample | null {
        const previousAt = this.at;
        const seconds = previousAt === null ? 0 : (now - previousAt) / 1000;
        const next = new Map<string, Record<string, number>>();

        /** How much a counter grew since the previous snapshot (null: nothing to compare with yet). */
        const grew = (stat: Stat, field: string): number | null => {
            const value = finite(stat[field]);
            if (value === undefined) return null;
            const id = idOf(stat);
            const memory = next.get(id) ?? {};
            memory[field] = value;
            next.set(id, memory);
            const before = this.counters.get(id)?.[field];
            return before === undefined ? null : Math.max(0, value - before);
        };

        let bytesOut = 0;
        let bytesIn = 0;
        let videoBytesIn = 0;
        let packetsIn = 0;
        let lostIn = 0;
        let freezes = 0;
        let videoOut: Stat | null = null;
        let videoOutFrames: number | null = null;
        let videoIn: Stat | null = null;
        let videoInFrames: number | null = null;
        const jitters: number[] = [];
        const remoteRtts: number[] = [];
        const remoteLosses: number[] = [];
        const pairs: Stat[] = [];
        const transports: Stat[] = [];
        const candidates = new Map<string, Stat>();

        for (const stat of stats) {
            switch (stat.type) {
                case "outbound-rtp": {
                    if (stat.isRemote === true) break;
                    bytesOut += grew(stat, "bytesSent") ?? 0;
                    if (kindOf(stat) === "video") {
                        const frames = grew(stat, "framesEncoded");
                        if (!videoOut || (finite(stat.frameWidth) ?? 0) > (finite(videoOut.frameWidth) ?? 0)) {
                            videoOut = stat;
                            videoOutFrames = frames;
                        }
                    }
                    break;
                }
                case "inbound-rtp": {
                    if (stat.isRemote === true) break;
                    const bytes = grew(stat, "bytesReceived") ?? 0;
                    bytesIn += bytes;
                    packetsIn += grew(stat, "packetsReceived") ?? 0;
                    lostIn += grew(stat, "packetsLost") ?? 0;
                    const jitter = finite(stat.jitter);
                    if (jitter !== undefined) jitters.push(jitter * 1000);
                    if (kindOf(stat) === "video") {
                        videoBytesIn += bytes;
                        freezes += grew(stat, "freezeCount") ?? 0;
                        const frames = grew(stat, "framesDecoded");
                        if (!videoIn || (finite(stat.frameWidth) ?? 0) > (finite(videoIn.frameWidth) ?? 0)) {
                            videoIn = stat;
                            videoInFrames = frames;
                        }
                    }
                    break;
                }
                case "remote-inbound-rtp": {
                    const rtt = finite(stat.roundTripTime);
                    if (rtt !== undefined && rtt > 0) remoteRtts.push(rtt * 1000);
                    const fraction = finite(stat.fractionLost);
                    if (fraction !== undefined) remoteLosses.push(fraction);
                    break;
                }
                case "candidate-pair":
                    pairs.push(stat);
                    break;
                case "transport":
                    transports.push(stat);
                    break;
                case "local-candidate":
                case "remote-candidate":
                    candidates.set(idOf(stat), stat);
                    break;
            }
        }

        this.counters = next;
        this.at = now;
        if (previousAt === null || seconds < 0.25) return null;

        const pair = selectedPair(pairs, transports);

        const pairRtt = finite(pair?.currentRoundTripTime);
        const rttMs = pairRtt !== undefined && pairRtt > 0 ? pairRtt * 1000 : remoteRtts.length > 0 ? Math.min(...remoteRtts) : null;

        const received = packetsIn + lostIn;
        const lossIn = received > 0 ? lostIn / received : null;
        const lossOut = remoteLosses.length > 0 ? Math.max(...remoteLosses) : null;
        const loss = lossIn === null && lossOut === null ? null : Math.max(lossIn ?? 0, lossOut ?? 0);

        const picture = (stat: Stat | null, frames: number | null): VideoPicture | null => {
            if (!stat) return null;
            const width = finite(stat.frameWidth);
            const height = finite(stat.frameHeight);
            if (!width || !height) return null;
            // Only a picture that moved during the interval counts as "being sent" or "being received".
            if (frames !== null && frames <= 0) return null;
            const fps = finite(stat.framesPerSecond) ?? (frames !== null ? frames / seconds : 0);
            return { width, height, fps: Math.round(fps) };
        };

        const reason = videoOut?.qualityLimitationReason;
        const limit: QualityLimit = reason === "bandwidth" || reason === "cpu" || reason === "other" ? reason : "none";

        const available = finite(pair?.availableOutgoingBitrate);
        const localCandidate = typeof pair?.localCandidateId === "string" ? candidates.get(pair.localCandidateId) : undefined;
        const remoteCandidate = typeof pair?.remoteCandidateId === "string" ? candidates.get(pair.remoteCandidateId) : undefined;
        const route = localCandidate ?? remoteCandidate;

        return {
            rttMs,
            jitterMs: jitters.length > 0 ? Math.max(...jitters) : null,
            loss,
            sendKbps: (bytesOut * 8) / seconds / 1000,
            receiveKbps: (bytesIn * 8) / seconds / 1000,
            availableSendKbps: available !== undefined && available > 0 ? available / 1000 : null,
            sent: picture(videoOut, videoOutFrames),
            received: picture(videoIn, videoInFrames),
            limit,
            frozen: freezes > 0 || (videoIn !== null && videoBytesIn > 1500 && videoInFrames === 0),
            silent: bytesIn <= 0,
            relayed: route && typeof route.candidateType === "string" ? route.candidateType === "relay" : null,
        };
    }
}

/* -------------------------------------------------------------------------------------------------
 * From a sample to a level
 * ---------------------------------------------------------------------------------------------- */

/** 0 up to `from`, `max` from `to` on, a straight line in between. */
const ramp = (value: number, from: number, to: number, max: number) => (value <= from ? 0 : value >= to ? max : ((value - from) / (to - from)) * max);

/** 0 (unusable) to 100 (perfect). Latency, loss and jitter are what a person actually hears and sees. */
export function scoreSample(sample: QualitySample): number {
    let score = 100;
    if (sample.rttMs !== null) score -= ramp(sample.rttMs, 150, 600, 45);
    if (sample.loss !== null) score -= ramp(sample.loss * 100, 0.5, 8, 70);
    if (sample.jitterMs !== null) score -= ramp(sample.jitterMs, 30, 120, 25);
    if (sample.frozen) score -= 20;
    if (sample.limit === "bandwidth") score -= 8;
    else if (sample.limit === "cpu") score -= 6;
    return Math.max(0, Math.min(100, score));
}

const LEVELS: readonly QualityLevel[] = ["lost", "poor", "fair", "good", "excellent"];

export function levelOfScore(score: number): QualityLevel {
    if (score >= 80) return "excellent";
    if (score >= 60) return "good";
    if (score >= 40) return "fair";
    return "poor";
}

/** Samples without any media in a row before the connection counts as lost. */
const LOST_AFTER_SILENT_SAMPLES = 3;
/** The indicator drops after this many samples that say "worse", and recovers after this many that say "better". */
const WORSE_AFTER = 2;
const BETTER_AFTER = 4;

/**
 * Keeps the indicator calm: scores are smoothed (falling fast, rising slowly) and the level only changes
 * once the new reading has held for a few samples, so it never flickers between two bars.
 */
export class QualityMeter {
    private score: number | null = null;
    private level: QualityLevel = "excellent";
    private pending: QualityLevel | null = null;
    private pendingCount = 0;
    private silent = 0;

    reset() {
        this.score = null;
        this.level = "excellent";
        this.pending = null;
        this.pendingCount = 0;
        this.silent = 0;
    }

    update(sample: QualitySample): { level: QualityLevel; score: number } {
        this.silent = sample.silent ? this.silent + 1 : 0;
        if (this.silent >= LOST_AFTER_SILENT_SAMPLES) {
            this.level = "lost";
            this.score = 0;
            this.pending = null;
            return { level: "lost", score: 0 };
        }

        const reading = scoreSample(sample);
        // The first reading, and the first one after being lost, say more than any history: take them as they are.
        const previous = this.level === "lost" ? null : this.score;
        const score = previous === null ? reading : previous + (reading - previous) * (reading < previous ? 0.6 : 0.3);
        this.score = score;
        const target = levelOfScore(score);

        if (previous === null) {
            this.level = target;
            this.pending = null;
            this.pendingCount = 0;
        } else if (target === this.level) {
            this.pending = null;
            this.pendingCount = 0;
        } else {
            this.pendingCount = this.pending === target ? this.pendingCount + 1 : 1;
            this.pending = target;
            const worse = LEVELS.indexOf(target) < LEVELS.indexOf(this.level);
            if (this.pendingCount >= (worse ? WORSE_AFTER : BETTER_AFTER)) {
                this.level = target;
                this.pending = null;
                this.pendingCount = 0;
            }
        }
        return { level: this.level, score: Math.round(score) };
    }
}

/* -------------------------------------------------------------------------------------------------
 * Video tiers: what to send at which quality
 * ---------------------------------------------------------------------------------------------- */

export type VideoTierId = "full" | "high" | "medium" | "low" | "minimal";

export interface VideoTier {
    id: VideoTierId;
    /** The short side of the picture sent, in pixels (1080 = "Full HD"), whatever its orientation. */
    shortSide: number;
    fps: number;
    /** Bitrate that looks good for a 16:9 picture of that size at that frame rate. */
    kbps: number;
}

/** Best first. */
export const VIDEO_TIERS: readonly VideoTier[] = [
    { id: "full", shortSide: 1080, fps: 30, kbps: 4500 },
    { id: "high", shortSide: 720, fps: 30, kbps: 2500 },
    { id: "medium", shortSide: 480, fps: 30, kbps: 1100 },
    { id: "low", shortSide: 360, fps: 24, kbps: 600 },
    { id: "minimal", shortSide: 240, fps: 15, kbps: 250 },
];

export interface CaptureSize {
    width: number;
    height: number;
}

/** What goes on the video sender (`RTCRtpEncodingParameters`). */
export interface VideoPlan {
    scaleResolutionDownBy: number;
    maxFramerate: number;
    /** bits per second */
    maxBitrate: number;
}

const MIN_VIDEO_BITRATE = 120_000;
/**
 * A picture with fewer pixels than 16:9 at the same height (a 4:3 phone camera) still gets most of the tier's
 * bitrate: the number is a ceiling, the network decides what is used, and spare room only helps motion.
 */
const MIN_PIXEL_SHARE = 0.9;
const MAX_PIXEL_SHARE = 1.5;

/**
 * The tiers worth using for a camera that delivers `capture`, best first: nothing above the camera's own
 * size is offered (it would change nothing), and `maxShortSide` is the most this device should send.
 */
export function videoLadder(capture: CaptureSize, maxShortSide = Number.POSITIVE_INFINITY): VideoTier[] {
    const short = Math.min(capture.width, capture.height);
    const allowed = VIDEO_TIERS.filter((tier) => tier.shortSide <= maxShortSide);
    const usable = allowed.length > 0 ? allowed : [VIDEO_TIERS[VIDEO_TIERS.length - 1]];

    // Start at the smallest tier that still covers the camera's picture.
    let start = 0;
    usable.forEach((tier, index) => {
        if (tier.shortSide >= short) start = index;
    });
    return usable.slice(start);
}

/** The encoder settings for sending `capture` at `tier`: scaled down to the tier's size, never up. */
export function planFor(tier: VideoTier, capture: CaptureSize): VideoPlan {
    const short = Math.max(1, Math.min(capture.width, capture.height));
    const scale = Math.max(1, short / tier.shortSide);
    const pixels = (capture.width * capture.height) / (scale * scale);
    const referencePixels = (tier.shortSide * tier.shortSide * 16) / 9;
    const share = Math.min(MAX_PIXEL_SHARE, Math.max(MIN_PIXEL_SHARE, pixels / referencePixels));

    return {
        scaleResolutionDownBy: Math.round(scale * 100) / 100,
        maxFramerate: tier.fps,
        maxBitrate: Math.round(Math.max(MIN_VIDEO_BITRATE, tier.kbps * 1000 * share)),
    };
}

/* -------------------------------------------------------------------------------------------------
 * The governor
 * ---------------------------------------------------------------------------------------------- */

/** The first seconds of a call are spent probing for bandwidth: its estimate says nothing yet. */
const WARM_UP_MS = 10_000;
/** Consecutive samples a problem must last before the tier drops. */
const LOSSY_AFTER = 2;
const CPU_BOUND_AFTER = 4;
const STARVED_AFTER = 5;
const SEVERE_AFTER = 4;
/** Consecutive healthy samples before the tier climbs one step. */
const HEALTHY_BEFORE_UPGRADE = 8;
/** After a drop the tier stays put this long (times 1 + recent flip-flops), so it doesn't bounce. */
const HOLD_MS = 15_000;
const FLIP_FLOP_WINDOW_MS = 45_000;
const MAX_FLIP_FLOPS = 3;
/** Video paused for the network is tried again after this long (doubling while it keeps failing). */
const PAUSE_MIN_MS = 20_000;
const PAUSE_MAX_MS = 80_000;
const PROBE_HEALTHY_SAMPLES = 6;
const PROBE_SEVERE_SAMPLES = 3;

export interface GovernorDecision {
    /** Index into the ladder: 0 is the best tier on offer. */
    tier: number;
    /** Video is switched off to keep the audio clear. */
    paused: boolean;
    /** The decision differs from the previous one. */
    changed: boolean;
}

/**
 * Decides the video tier from the stream of samples:
 *   - heavy loss, very high latency, a CPU that can't keep up, or a bandwidth estimate far below what the
 *     current tier needs: one step down (the estimate can skip several steps)
 *   - clearly bad for a while even at the lowest tier: video pauses, audio carries on; it is tried again
 *     now and then and stays only if the network copes
 *   - good for a while: one step back up, but never right after a drop
 */
export class VideoGovernor {
    private index = 0;
    private paused = false;
    private startedAt: number | null = null;
    private lossy = 0;
    private cpuBound = 0;
    private starved = 0;
    private severe = 0;
    private healthy = 0;
    private holdUntil = 0;
    private lastUpgradeAt = Number.NEGATIVE_INFINITY;
    private lastDropAt = Number.NEGATIVE_INFINITY;
    private flipFlops = 0;
    private pausedAt = 0;
    private pauseMs = PAUSE_MIN_MS;
    private probing = false;
    private probeHealthy = 0;
    private probeSevere = 0;

    get tier(): number {
        return this.index;
    }

    get isPaused(): boolean {
        return this.paused;
    }

    reset() {
        Object.assign(this, new VideoGovernor());
    }

    update(sample: QualitySample, ladder: readonly VideoTier[], capture: CaptureSize, now: number): GovernorDecision {
        if (this.startedAt === null) this.startedAt = now;
        const lowest = Math.max(0, ladder.length - 1);
        const before = { tier: Math.min(this.index, lowest), paused: this.paused };
        this.index = before.tier;

        // Without anything arriving, loss and latency say nothing: the connection logic handles that case.
        if (!sample.silent) this.observe(sample, ladder, capture, now, lowest);

        return { tier: this.index, paused: this.paused, changed: this.index !== before.tier || this.paused !== before.paused };
    }

    private observe(sample: QualitySample, ladder: readonly VideoTier[], capture: CaptureSize, now: number, lowest: number) {
        const loss = sample.loss ?? 0;
        const rtt = sample.rttMs ?? 0;
        const available = sample.availableSendKbps;
        const warm = now - (this.startedAt ?? now) >= WARM_UP_MS;

        const need = (index: number) => planFor(ladder[index], capture).maxBitrate / 1000;
        const lossy = loss >= 0.08 || rtt >= 700;
        const cpuBound = sample.limit === "cpu";
        // Only a link that is really full counts as starved: below its ceiling, the estimate says nothing.
        const starved = warm && available !== null && sample.sendKbps >= available * 0.7 && available < need(this.index) * 0.5;
        const severe = loss >= 0.3 || (warm && available !== null && available < 120);
        const healthy = loss < 0.02 && rtt < 350 && !cpuBound;

        if (this.paused) {
            if (now - this.pausedAt >= this.pauseMs) {
                // Try video again at the smallest size and see how the network takes it.
                this.paused = false;
                this.index = lowest;
                this.probing = true;
                this.probeHealthy = 0;
                this.probeSevere = 0;
                this.clearCounters();
            }
            return;
        }

        this.lossy = lossy ? this.lossy + 1 : 0;
        this.cpuBound = cpuBound ? this.cpuBound + 1 : 0;
        this.starved = starved ? this.starved + 1 : 0;
        this.severe = severe ? this.severe + 1 : 0;

        if (this.probing) {
            this.probeSevere = severe ? this.probeSevere + 1 : 0;
            this.probeHealthy = healthy ? this.probeHealthy + 1 : 0;
            if (this.probeSevere >= PROBE_SEVERE_SAMPLES) return this.pause(now, true);
            if (this.probeHealthy >= PROBE_HEALTHY_SAMPLES) {
                this.probing = false;
                this.pauseMs = PAUSE_MIN_MS;
            }
        }

        let target = this.index;
        if (this.lossy >= LOSSY_AFTER || this.cpuBound >= CPU_BOUND_AFTER) target = this.index + 1;
        if (this.starved >= STARVED_AFTER) {
            // The estimate says what fits: go straight to the best tier that fits it with some room to spare.
            let fitting = lowest;
            for (let index = this.index + 1; index <= lowest; index++) {
                if (need(index) <= (available ?? 0) * 0.85) {
                    fitting = index;
                    break;
                }
            }
            target = Math.max(target, fitting);
        }

        if (target > this.index) {
            if (this.index >= lowest) {
                if (this.severe >= SEVERE_AFTER) this.pause(now, false);
                return;
            }
            this.stepDown(Math.min(target, lowest), now);
            return;
        }
        if (this.index >= lowest && this.severe >= SEVERE_AFTER) return this.pause(now, false);

        this.healthy = healthy && !this.probing ? this.healthy + 1 : 0;
        if (this.index > 0 && this.healthy >= HEALTHY_BEFORE_UPGRADE && now >= this.holdUntil) {
            this.index -= 1;
            this.healthy = 0;
            this.lastUpgradeAt = now;
        }
    }

    private stepDown(to: number, now: number) {
        // A drop soon after a climb means the climb was too optimistic: wait longer before trying again.
        if (now - this.lastUpgradeAt < FLIP_FLOP_WINDOW_MS) this.flipFlops = Math.min(this.flipFlops + 1, MAX_FLIP_FLOPS);
        else if (now - this.lastDropAt > 4 * FLIP_FLOP_WINDOW_MS) this.flipFlops = 0;
        this.index = to;
        this.lastDropAt = now;
        this.holdUntil = now + HOLD_MS * (1 + this.flipFlops);
        this.clearCounters();
    }

    private pause(now: number, failedProbe: boolean) {
        this.paused = true;
        this.pausedAt = now;
        this.probing = false;
        this.pauseMs = failedProbe ? Math.min(this.pauseMs * 2, PAUSE_MAX_MS) : PAUSE_MIN_MS;
        this.clearCounters();
    }

    private clearCounters() {
        this.lossy = 0;
        this.cpuBound = 0;
        this.starved = 0;
        this.severe = 0;
        this.healthy = 0;
    }
}
