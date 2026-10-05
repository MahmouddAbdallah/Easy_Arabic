/**
 * The WebRTC half of a call, with no knowledge of React, Firestore or the API: it owns the
 * RTCPeerConnection and the microphone/camera, and talks to the outside through a few callbacks.
 *
 *   media          getUserMedia (+ camera released when "camera off", switched between cameras)
 *   negotiation    "perfect negotiation": either side may renegotiate (ICE restart after a network
 *                  change) without the two offers colliding; the callee is the polite peer
 *   signaling out  ICE candidates are batched and only sent once `setSignalingReady(true)`
 *   signaling in   handled strictly one at a time, candidates wait for the remote description
 *   state channel  a tiny RTCDataChannel carries "muted" / "camera off" to the other person's screen
 */
import {
    MAX_SIGNALS_PER_REQUEST,
    type CallIceCandidate,
    type CallAnswer,
    type CallIceServer,
    type CallMode,
    type CallOffer,
    type CallRole,
    type CallSessionDescription,
    type CallSignal,
    type CallSignalInput,
} from "./call";

export type EngineConnectionState = "connecting" | "connected" | "disconnected" | "failed" | "closed";

export interface RemoteMediaState {
    muted: boolean;
    cameraOff: boolean;
}

export interface CallEngineEvents {
    /** Signaling messages for the other side. Only called once `setSignalingReady(true)`. */
    onSignals: (signals: CallSignalInput[]) => void;
    onConnectionState: (state: EngineConnectionState) => void;
    /** The local preview changed (camera switched, turned on or off, device replaced). */
    onLocalStream: (stream: MediaStream) => void;
    /** A new stream holding the other person's current tracks. */
    onRemoteStream: (stream: MediaStream) => void;
    onRemoteMedia: (state: RemoteMediaState) => void;
    /** A device was unplugged mid-call and could not be replaced. */
    onDeviceLost: (kind: "audio" | "video") => void;
}

/* -------------------------------------------------------------------------------------------------
 * Browser support and getting the devices
 * ---------------------------------------------------------------------------------------------- */

/** Why calls can't work in this browser, or null when they can. */
export function getCallSupportProblem(): string | null {
    if (typeof window === "undefined") return "Calls need a browser.";
    if (!window.isSecureContext) return "Calls need a secure (HTTPS) connection.";
    if (typeof RTCPeerConnection === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        return "Your browser doesn't support voice and video calls.";
    }
    return null;
}

/** getUserMedia failed. Carries what the browser said and what the call was for. */
export class CallMediaError extends Error {
    constructor(
        public readonly original: unknown,
        public readonly mode: CallMode
    ) {
        super("Could not open the microphone or camera.");
        this.name = "CallMediaError";
    }
}

/** A getUserMedia error as text for a toast. */
export function getCallMediaErrorMessage(error: unknown): string {
    const mode = error instanceof CallMediaError ? error.mode : "audio";
    const name = ((error instanceof CallMediaError ? error.original : error) as { name?: string } | null)?.name;
    const devices = mode === "video" ? "microphone or camera" : "microphone";

    switch (name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
        case "SecurityError":
            return typeof window !== "undefined" && window.isSecureContext === false
                ? "Calls need a secure (HTTPS) connection."
                : `Your ${devices} is blocked. Allow it for this site in your browser settings, then try again.`;
        case "NotFoundError":
        case "DevicesNotFoundError":
        case "OverconstrainedError":
            return "No microphone was found. Connect one and try again.";
        case "NotReadableError":
        case "TrackStartError":
        case "AbortError":
            return `Your ${devices} is busy or unavailable. Close other apps that use it and try again.`;
        default:
            return "Couldn't start the call. Please try again.";
    }
}

/** Turning the camera on (or switching it) failed. */
export function getCameraErrorMessage(error: unknown): string {
    switch ((error as { name?: string } | null)?.name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
        case "SecurityError":
            return "Camera access is blocked. Allow it for this site in your browser settings, then try again.";
        case "NotFoundError":
        case "DevicesNotFoundError":
        case "OverconstrainedError":
            return "No camera was found.";
        case "NotReadableError":
        case "TrackStartError":
        case "AbortError":
            return "Your camera is busy or unavailable. Close other apps that use it and try again.";
        default:
            return "Couldn't use the camera. Please try again.";
    }
}

const AUDIO: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const VIDEO: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } };

export interface LocalMedia {
    stream: MediaStream;
    /** A video call went ahead without a camera (missing, busy or blocked): the person is heard but not seen. */
    videoUnavailable: boolean;
}

/** Opens the microphone (and the camera for a video call). Throws CallMediaError. */
export async function openLocalMedia(mode: CallMode): Promise<LocalMedia> {
    const devices = navigator.mediaDevices;
    try {
        try {
            const stream = await devices.getUserMedia({
                audio: AUDIO,
                video: mode === "video" ? { ...VIDEO, facingMode: "user" } : false,
            });
            return { stream, videoUnavailable: false };
        } catch (error) {
            if (mode !== "video") throw error;
            // A call without a working camera is still a call. If the microphone is the problem, this throws too.
            return { stream: await devices.getUserMedia({ audio: AUDIO }), videoUnavailable: true };
        }
    } catch (error) {
        throw new CallMediaError(error, mode);
    }
}

async function openTrack(kind: "audio" | "video", deviceId?: string): Promise<MediaStreamTrack> {
    const stream = await navigator.mediaDevices.getUserMedia(
        kind === "audio"
            ? { audio: AUDIO }
            : { video: { ...VIDEO, ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" }) } }
    );
    const track = (kind === "audio" ? stream.getAudioTracks() : stream.getVideoTracks())[0];
    if (!track) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error(`No ${kind} track`);
    }
    return track;
}

/* -------------------------------------------------------------------------------------------------
 * The engine
 * ---------------------------------------------------------------------------------------------- */

/** Candidates arrive in bursts; sending them together keeps the number of requests down. */
const CANDIDATE_BATCH_MS = 120;

interface ControlMessage {
    v: 1;
    muted: boolean;
    cameraOff: boolean;
}

export interface CallEngineOptions {
    role: CallRole;
    mode: CallMode;
    iceServers: CallIceServer[];
    /** The engine takes ownership of these tracks and stops them on `close()`. */
    media: LocalMedia;
    events: CallEngineEvents;
}

const toSessionDescription = <T extends "offer" | "answer">(
    description: RTCSessionDescription | RTCSessionDescriptionInit | null,
    type: T
): { type: T; sdp: string } => {
    if (!description?.sdp) throw new Error("The browser produced an empty session description.");
    return { type, sdp: description.sdp };
};

export class CallEngine {
    private readonly pc: RTCPeerConnection;
    private readonly control: RTCDataChannel;
    private readonly mode: CallMode;
    private readonly events: CallEngineEvents;
    /** The callee: gives way when both sides make an offer at the same moment. */
    private readonly polite: boolean;

    private local: MediaStream;
    private remoteTracks: MediaStreamTrack[] = [];
    private muted = false;
    private cameraOff: boolean;
    private cameraId: string | undefined;
    private closed = false;
    private lastState: EngineConnectionState | null = null;

    // Negotiation (the "perfect negotiation" pattern).
    private makingOffer = false;
    private ignoreOffer = false;
    private settingRemoteAnswer = false;
    /** Renegotiation only starts once the first offer/answer exchange is done. */
    private negotiationEnabled = false;
    private pendingCandidates: RTCIceCandidateInit[] = [];
    private inbox: Promise<void> = Promise.resolve();

    // Outgoing signaling.
    private outbox: CallSignalInput[] = [];
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private ready = false;

    constructor({ role, mode, iceServers, media, events }: CallEngineOptions) {
        this.mode = mode;
        this.events = events;
        this.polite = role === "callee";
        this.local = media.stream;
        this.cameraOff = mode === "video" && media.stream.getVideoTracks().length === 0;
        this.cameraId = media.stream.getVideoTracks()[0]?.getSettings().deviceId;

        this.pc = new RTCPeerConnection({
            iceServers,
            bundlePolicy: "max-bundle",
            rtcpMuxPolicy: "require",
            iceCandidatePoolSize: 2,
        });

        // Both sides create the same pre-agreed channel, so there is no "who opens it" race.
        this.control = this.pc.createDataChannel("call-state", { negotiated: true, id: 0 });
        this.control.onopen = () => this.sendMediaState();
        this.control.onmessage = (event) => this.receiveMediaState(event.data);

        this.pc.onicecandidate = ({ candidate }) => {
            if (candidate) this.queue({ type: "candidate", data: candidate.toJSON() as CallIceCandidate });
        };
        this.pc.ontrack = ({ track }) => {
            if (!this.remoteTracks.includes(track)) this.remoteTracks.push(track);
            this.events.onRemoteStream(new MediaStream(this.remoteTracks));
        };
        this.pc.onnegotiationneeded = () => {
            if (this.negotiationEnabled) void this.renegotiate();
        };

        const report = () => {
            const state = this.connectionState();
            if (state === this.lastState) return;
            this.lastState = state;
            this.events.onConnectionState(state);
        };
        this.pc.addEventListener("connectionstatechange", report);
        this.pc.addEventListener("iceconnectionstatechange", report);

        this.local.getTracks().forEach((track) => this.watch(track));
    }

    /* ---- what the UI reads ---- */

    get localStream(): MediaStream {
        return this.local;
    }

    get isMuted(): boolean {
        return this.muted;
    }

    get isCameraOff(): boolean {
        return this.cameraOff;
    }

    /** The front camera is shown mirrored, like a mirror; the back camera is not. */
    get mirrorLocal(): boolean {
        return this.local.getVideoTracks()[0]?.getSettings().facingMode !== "environment";
    }

    async canSwitchCamera(): Promise<boolean> {
        if (this.mode !== "video" || this.closed) return false;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter((device) => device.kind === "videoinput").length > 1;
        } catch {
            return false;
        }
    }

    /* ---- starting the call ---- */

    /** Caller: builds the first offer. */
    async createOffer(): Promise<CallOffer> {
        this.local.getTracks().forEach((track) => this.pc.addTrack(track, this.local));
        // A video call without a camera must still receive the other person's video.
        if (this.mode === "video" && this.local.getVideoTracks().length === 0) {
            this.pc.addTransceiver("video", { direction: "recvonly" });
        }

        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        this.negotiationEnabled = true;
        return toSessionDescription(this.pc.localDescription ?? offer, "offer");
    }

    /** Callee: applies the caller's offer and builds the answer. */
    async acceptOffer(offer: CallOffer): Promise<CallAnswer> {
        await this.pc.setRemoteDescription(offer);
        await this.drainRemoteCandidates();
        // The tracks go on after the offer is applied, so they reuse the transceivers the offer created.
        this.local.getTracks().forEach((track) => this.pc.addTrack(track, this.local));

        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.negotiationEnabled = true;
        return toSessionDescription(this.pc.localDescription ?? answer, "answer");
    }

    /* ---- signaling ---- */

    /** Until this is true nothing is sent: the call doesn't exist on the server yet. */
    setSignalingReady(ready: boolean) {
        this.ready = ready;
        if (ready) this.flush();
    }

    /** Applies one message from the other side. Strictly one at a time, in order. */
    handleSignal(signal: CallSignal): Promise<void> {
        this.inbox = this.inbox
            .then(() => (this.closed ? undefined : this.process(signal)))
            .catch((error) => {
                if (!this.closed) console.warn("[call] Couldn't apply a signaling message:", error);
            });
        return this.inbox;
    }

    private async process(signal: CallSignal) {
        if (signal.type === "candidate") return this.addCandidate(signal.data);
        return this.applyDescription(signal.data);
    }

    private async applyDescription(description: CallSessionDescription) {
        const isOffer = description.type === "offer";
        // An offer that arrives while we are making one (or are not stable) is a collision.
        const readyForOffer = !this.makingOffer && (this.pc.signalingState === "stable" || this.settingRemoteAnswer);
        this.ignoreOffer = isOffer && !readyForOffer && !this.polite;
        if (this.ignoreOffer) return;

        this.settingRemoteAnswer = !isOffer;
        try {
            // For the polite peer this rolls back its own offer first, so the other side's offer wins.
            await this.pc.setRemoteDescription(description);
        } finally {
            this.settingRemoteAnswer = false;
        }
        await this.drainRemoteCandidates();

        if (isOffer) {
            await this.pc.setLocalDescription();
            this.queue({ type: "answer", data: toSessionDescription(this.pc.localDescription, "answer") }, true);
        }
    }

    private async addCandidate(candidate: CallIceCandidate) {
        const init: RTCIceCandidateInit = {
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid ?? null,
            sdpMLineIndex: candidate.sdpMLineIndex ?? null,
            ...(candidate.usernameFragment ? { usernameFragment: candidate.usernameFragment } : {}),
        };
        // Candidates can overtake the offer they belong to; they wait for it.
        if (!this.pc.remoteDescription) {
            this.pendingCandidates.push(init);
            return;
        }
        try {
            await this.pc.addIceCandidate(init);
        } catch (error) {
            // Candidates of an offer we ignored are expected to fail.
            if (!this.ignoreOffer) console.warn("[call] Couldn't add an ICE candidate:", error);
        }
    }

    private async drainRemoteCandidates() {
        const waiting = this.pendingCandidates.splice(0);
        for (const init of waiting) {
            try {
                await this.pc.addIceCandidate(init);
            } catch (error) {
                console.warn("[call] Couldn't add an ICE candidate:", error);
            }
        }
    }

    private async renegotiate() {
        if (this.closed) return;
        try {
            this.makingOffer = true;
            // No argument: the browser builds the right offer, including an ICE restart if one was asked for.
            await this.pc.setLocalDescription();
            this.queue({ type: "offer", data: toSessionDescription(this.pc.localDescription, "offer") }, true);
        } catch (error) {
            if (!this.closed) console.warn("[call] Couldn't renegotiate:", error);
        } finally {
            this.makingOffer = false;
        }
    }

    /** The network changed or dropped: find a new route. Both sides may call this; collisions are handled. */
    restartIce() {
        if (this.closed || typeof this.pc.restartIce !== "function") return;
        this.pc.restartIce();
    }

    private queue(signal: CallSignalInput, immediately = false) {
        if (this.closed) return;
        this.outbox.push(signal);
        if (immediately) this.flush();
        else if (this.flushTimer === null) this.flushTimer = setTimeout(() => this.flush(), CANDIDATE_BATCH_MS);
    }

    private flush() {
        if (this.flushTimer !== null) clearTimeout(this.flushTimer);
        this.flushTimer = null;
        if (!this.ready || this.closed) return;

        while (this.outbox.length > 0) {
            this.events.onSignals(this.outbox.splice(0, MAX_SIGNALS_PER_REQUEST));
        }
    }

    private connectionState(): EngineConnectionState {
        // Older Firefox has no `connectionState`; the ICE state is the next best thing.
        const state = this.pc.connectionState as RTCPeerConnectionState | undefined;
        const raw = state ?? this.pc.iceConnectionState;
        switch (raw) {
            case "connected":
            case "completed":
                return "connected";
            case "disconnected":
                return "disconnected";
            case "failed":
                return "failed";
            case "closed":
                return "closed";
            default:
                return "connecting";
        }
    }

    /* ---- microphone and camera ---- */

    setMuted(muted: boolean) {
        this.muted = muted;
        // A disabled track keeps the device open and sends silence: unmuting is instant.
        this.local.getAudioTracks().forEach((track) => (track.enabled = !muted));
        this.sendMediaState();
    }

    /** Turning the camera off releases it (its light goes out) instead of just sending black frames. */
    async setCameraOff(off: boolean): Promise<void> {
        if (this.mode !== "video" || off === this.cameraOff || this.closed) return;

        if (off) {
            this.cameraOff = true;
            await this.swapTrack("video", null);
        } else {
            const track = await openTrack("video", this.cameraId); // throws if the camera can't be opened: stays off
            await this.swapTrack("video", track);
            this.cameraOff = false;
        }
        this.sendMediaState();
    }

    /** Next camera (front/back on a phone). The current one is released first: many phones can't open two. */
    async switchCamera(): Promise<void> {
        if (this.mode !== "video" || this.cameraOff || this.closed) return;

        const cameras = (await navigator.mediaDevices.enumerateDevices()).filter(
            (device) => device.kind === "videoinput" && device.deviceId
        );
        if (cameras.length < 2) return;

        const currentId = this.local.getVideoTracks()[0]?.getSettings().deviceId ?? this.cameraId;
        const next = cameras[(cameras.findIndex((camera) => camera.deviceId === currentId) + 1) % cameras.length];

        this.local.getVideoTracks().forEach((track) => track.stop());
        try {
            await this.swapTrack("video", await openTrack("video", next.deviceId));
            this.cameraId = next.deviceId;
        } catch (error) {
            // Couldn't open the other camera: go back to the one that worked.
            await this.swapTrack("video", await openTrack("video", currentId)).catch(() => this.events.onDeviceLost("video"));
            throw error;
        }
    }

    private transceiver(kind: "audio" | "video"): RTCRtpTransceiver | undefined {
        return this.pc.getTransceivers().find((t) => t.receiver.track.kind === kind);
    }

    /** Puts `next` (or nothing) on the wire in place of the current track of that kind. */
    private async swapTrack(kind: "audio" | "video", next: MediaStreamTrack | null) {
        const current = this.local.getTracks().find((track) => track.kind === kind);
        const transceiver = this.transceiver(kind);

        // A call that started without a camera only receives video; sending needs the direction changed.
        if (next && transceiver && (transceiver.direction === "recvonly" || transceiver.direction === "inactive")) {
            transceiver.direction = "sendrecv";
        }
        await transceiver?.sender.replaceTrack(next);

        current?.stop();
        const others = this.local.getTracks().filter((track) => track !== current);
        if (next) {
            if (kind === "audio") next.enabled = !this.muted;
            this.watch(next);
        }
        this.local = new MediaStream(next ? [...others, next] : others);
        this.events.onLocalStream(this.local);
    }

    /** A device that disappears mid-call (unplugged, taken by another app) is replaced if possible. */
    private watch(track: MediaStreamTrack) {
        // `ended` is only fired when the device went away: stopping a track ourselves doesn't fire it.
        track.addEventListener("ended", async () => {
            if (this.closed || !this.local.getTracks().includes(track)) return;
            const kind = track.kind as "audio" | "video";
            try {
                await this.swapTrack(kind, await openTrack(kind, kind === "video" ? this.cameraId : undefined));
            } catch {
                this.events.onDeviceLost(kind);
            }
        });
    }

    /* ---- "muted" and "camera off" for the other person's screen ---- */

    private sendMediaState() {
        if (this.control.readyState !== "open") return;
        const message: ControlMessage = { v: 1, muted: this.muted, cameraOff: this.cameraOff };
        try {
            this.control.send(JSON.stringify(message));
        } catch {
            /* only a hint for the other screen; nothing to do */
        }
    }

    private receiveMediaState(raw: unknown) {
        if (typeof raw !== "string" || raw.length > 256) return;
        try {
            const message = JSON.parse(raw) as Partial<ControlMessage> | null;
            if (message?.v !== 1) return;
            this.events.onRemoteMedia({ muted: message.muted === true, cameraOff: message.cameraOff === true });
        } catch {
            /* not ours */
        }
    }

    /* ---- the end ---- */

    /** Stops the devices and closes the connection. Safe to call twice. */
    close() {
        if (this.closed) return;
        this.closed = true;
        if (this.flushTimer !== null) clearTimeout(this.flushTimer);
        this.flushTimer = null;
        this.outbox = [];

        this.local.getTracks().forEach((track) => track.stop());
        this.pc.onicecandidate = null;
        this.pc.ontrack = null;
        this.pc.onnegotiationneeded = null;
        this.control.onopen = null;
        this.control.onmessage = null;
        try {
            this.control.close();
            this.pc.close();
        } catch {
            /* already closed */
        }
    }
}
