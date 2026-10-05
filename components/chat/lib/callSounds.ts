/**
 * The sounds of a call, synthesized with the Web Audio API (the project ships no audio files):
 *   ringtone  incoming call: a soft three-note chime, repeating
 *   ringback  outgoing call: the classic "ring... ring..." the caller hears while the other side rings
 *   ended / busy  short tones when a call finishes
 * plus vibration on phones. Everything is best effort and silent when the browser refuses audio.
 *
 * Browsers only let a page make sound after the person has interacted with it, so the audio context is
 * created and resumed by the first tap/click/key press (`unlockCallSounds`); a call that rings before
 * that is visual only.
 */

interface ToneStep {
    freqs: number[];
    /** Tone length, then silence, in milliseconds. */
    on: number;
    off: number;
}

const RINGTONE: ToneStep[] = [
    { freqs: [523.25], on: 170, off: 50 }, // C5
    { freqs: [659.25], on: 170, off: 50 }, // E5
    { freqs: [783.99], on: 280, off: 1900 }, // G5
];
const RINGBACK: ToneStep[] = [{ freqs: [440, 480], on: 1100, off: 3000 }];
const ENDED: ToneStep[] = [
    { freqs: [480], on: 140, off: 90 },
    { freqs: [480], on: 140, off: 0 },
];
const BUSY: ToneStep[] = [
    { freqs: [480, 620], on: 420, off: 380 },
    { freqs: [480, 620], on: 420, off: 380 },
    { freqs: [480, 620], on: 420, off: 0 },
];

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!context) {
        const Ctor =
            window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        try {
            context = new Ctor();
        } catch {
            return null;
        }
    }
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    return context;
}

let unlockInstalled = false;

/** Call once. The first interaction with the page lets the call sounds play from then on. */
export function unlockCallSounds(): void {
    if (unlockInstalled || typeof window === "undefined") return;
    unlockInstalled = true;

    const events = ["pointerdown", "keydown", "touchstart"] as const;
    const unlock = () => {
        const ctx = audioContext();
        if (ctx?.state === "running") events.forEach((name) => window.removeEventListener(name, unlock));
    };
    events.forEach((name) => window.addEventListener(name, unlock, { passive: true }));
}

function burst(freqs: number[], durationMs: number, volume: number) {
    const ctx = audioContext();
    if (!ctx || ctx.state !== "running") return;

    const start = ctx.currentTime + 0.01;
    const end = start + durationMs / 1000;
    const gain = ctx.createGain();
    // A short fade in and out: a hard edge would click.
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.02);
    gain.gain.setValueAtTime(volume, Math.max(start + 0.02, end - 0.05));
    gain.gain.linearRampToValueAtTime(0, end);
    gain.connect(ctx.destination);

    for (const freq of freqs) {
        const oscillator = ctx.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.value = freq;
        oscillator.connect(gain);
        oscillator.start(start);
        oscillator.stop(end + 0.02);
        oscillator.onended = () => oscillator.disconnect();
    }
    window.setTimeout(() => gain.disconnect(), durationMs + 100);
}

/** Plays `steps` once, or over and over until stopped. */
class TonePlayer {
    private timer: ReturnType<typeof setTimeout> | null = null;
    private running = false;

    constructor(
        private readonly steps: ToneStep[],
        private readonly volume: number,
        private readonly repeat: boolean
    ) {}

    start() {
        if (this.running) return;
        this.running = true;
        audioContext();

        let index = 0;
        const tick = () => {
            if (!this.running) return;
            const step = this.steps[index % this.steps.length];
            burst(step.freqs, step.on, this.volume);
            index += 1;
            if (!this.repeat && index >= this.steps.length) {
                this.running = false;
                return;
            }
            this.timer = setTimeout(tick, step.on + step.off);
        };
        tick();
    }

    stop() {
        this.running = false;
        if (this.timer !== null) clearTimeout(this.timer);
        this.timer = null;
    }
}

const ringtone = new TonePlayer(RINGTONE, 0.22, true);
const ringback = new TonePlayer(RINGBACK, 0.12, true);

let vibrationTimer: ReturnType<typeof setInterval> | null = null;

function vibrate(pattern: number | number[]) {
    // Browsers refuse to vibrate before the person has touched the page (and log a warning about it).
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    navigator.vibrate(pattern);
}

export const callSounds = {
    startRingtone() {
        ringtone.start();
        if (vibrationTimer === null) {
            vibrate([350, 150, 350]);
            vibrationTimer = setInterval(() => vibrate([350, 150, 350]), 2400);
        }
    },
    stopRingtone() {
        ringtone.stop();
        if (vibrationTimer !== null) {
            clearInterval(vibrationTimer);
            vibrationTimer = null;
            vibrate(0);
        }
    },
    startRingback: () => ringback.start(),
    stopRingback: () => ringback.stop(),
    playEnded: () => new TonePlayer(ENDED, 0.14, false).start(),
    playBusy: () => new TonePlayer(BUSY, 0.14, false).start(),
    stopAll() {
        this.stopRingtone();
        this.stopRingback();
    },
};
