/**
 * CLIENT ONLY — browser APIs. Never import this from server code.
 *
 * The in-app notification sound: a short two-note chime synthesised with the Web Audio API, so there is
 * no audio file to download (zero requests, nothing to cache or keep in step) and nothing to preload.
 *
 * Browsers refuse to make sound until the person has interacted with the page, and they warn in the
 * console when a page even tries. So nothing here touches audio until `armAudioUnlock()` sees the first
 * click, tap or key press; before that `playNotificationSound()` simply reports false. A sound that cannot
 * play right now is dropped, never queued — a burst of old chimes on the first click would be worse than silence.
 *
 * It is also kept polite:
 *   - only a visible tab plays (a hidden tab's alert is the system notification, or the list);
 *   - at most one chime per `minGapMs`, however many notifications arrive;
 *   - with several tabs open, one tab plays per alert (Web Locks), not all of them.
 *
 * How it sounds — volume, waveform, the notes, how long they ring, the minimum gap, an audio file to play instead —
 * is the admin's sound configuration (../config.ts → SoundConfig), passed in by the caller. Every parameter defaults
 * to the original chime, so calling these with no configuration sounds exactly as before.
 */
import { DEFAULT_SOUND_CONFIG, chimeGain, type SoundConfig } from '../config';

const CROSS_TAB_LOCK_MS = 2_000;

let context: AudioContext | undefined;
let lastPlayedAt = 0;

type AudioContextConstructor = typeof AudioContext;

function createContext(): AudioContext | undefined {
    if (context) return context;
    if (typeof window === 'undefined') return undefined;

    const Ctor: AudioContextConstructor | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!Ctor) return undefined;

    try {
        context = new Ctor();
    } catch {
        return undefined;
    }
    return context;
}

/**
 * Unlocks audio on the person's first interaction with the page (the only moment browsers allow it).
 * Safe to call repeatedly and from an effect; returns a function that removes the listeners.
 */
export function armAudioUnlock(): () => void {
    if (typeof window === 'undefined' || context?.state === 'running') return () => {};

    const events = ['pointerdown', 'pointerup', 'keydown', 'touchend'] as const;
    const remove = () => events.forEach((type) => window.removeEventListener(type, unlock, true));

    function unlock() {
        const ctx = createContext();
        if (!ctx) return remove();
        void ctx.resume().then(
            () => {
                if (ctx.state === 'running') remove();
            },
            () => {}
        );
    }

    events.forEach((type) => window.addEventListener(type, unlock, { capture: true, passive: true }));
    return remove;
}

/** The configured notes (by default E5 then A5: two soft sine notes) with a quick attack and a short decay. */
function chime(ctx: AudioContext, sound: SoundConfig) {
    const start = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = chimeGain(sound.volume);
    master.connect(ctx.destination);

    const decay = sound.noteDurationMs / 1000;

    sound.notes.forEach(({ frequency, delayMs }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = sound.tone;
        osc.frequency.value = frequency;

        const at = start + delayMs / 1000;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(1, at + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);

        osc.connect(gain).connect(master);
        osc.start(at);
        osc.stop(at + decay + 0.03);
    });
}

/** Plays the configured audio file at the configured volume. Resolves to whether the browser let it play. */
async function playFile(url: string, volume: number): Promise<boolean> {
    try {
        const audio = new Audio(url);
        audio.volume = Math.min(1, Math.max(0, volume / 100));
        await audio.play();
        return true;
    } catch {
        return false; // blocked by the browser, or the file could not be loaded
    }
}

/**
 * True for exactly one tab per `id`: the first to ask. Holds the lock briefly so tabs that ask a moment
 * later lose. Browsers without Web Locks (or an insecure page) just say yes.
 */
function claim(id: string): Promise<boolean> {
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    if (!locks) return Promise.resolve(true);

    return new Promise((resolve) => {
        locks
            .request(`notification-sound:${id}`, { ifAvailable: true }, async (lock) => {
                resolve(lock !== null);
                if (lock) await new Promise((done) => setTimeout(done, CROSS_TAB_LOCK_MS));
            })
            .catch(() => resolve(true));
    });
}

/**
 * Plays the notification sound if it may play right now. Resolves to whether it did. `id` identifies the
 * alert so that only one of several open tabs plays it. `sound` is the configured sound; while its master
 * switch is off nothing plays.
 */
export async function playNotificationSound(id?: string, sound: SoundConfig = DEFAULT_SOUND_CONFIG): Promise<boolean> {
    if (!sound.enabled || typeof document === 'undefined' || document.visibilityState !== 'visible') return false;

    const now = Date.now();
    if (now - lastPlayedAt < sound.minGapMs) return false;

    // The person must have interacted with the page first, or the browser refuses (and complains in the console).
    let ctx: AudioContext | undefined;
    if (sound.customUrl) {
        if (typeof navigator !== 'undefined' && navigator.userActivation && !navigator.userActivation.hasBeenActive) return false;
    } else {
        ctx = context;
        if (!ctx) return false;
        if (ctx.state !== 'running') {
            void ctx.resume().catch(() => {}); // may succeed for next time; never wait for it
            return false;
        }
    }

    lastPlayedAt = now;
    if (sound.onePerAlertAcrossTabs && id && !(await claim(id))) return false;

    if (ctx) {
        chime(ctx, sound);
        return true;
    }
    return playFile(sound.customUrl as string, sound.volume);
}

/**
 * Plays `sound` for a "Play sample" button — the settings screen's and the dashboard's. Called from a click, so it
 * may also unlock audio; it ignores the politeness rules above (and the master switch, so an admin can try a sound
 * before turning it on) because the person asked to hear it.
 */
export async function previewNotificationSound(sound: SoundConfig = DEFAULT_SOUND_CONFIG): Promise<boolean> {
    if (sound.customUrl) return playFile(sound.customUrl, sound.volume);

    const ctx = createContext();
    if (!ctx) return false;

    try {
        await ctx.resume();
    } catch {
        return false;
    }
    if (ctx.state !== 'running') return false;

    chime(ctx, sound);
    return true;
}
