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
 *   - at most one chime per MIN_GAP_MS, however many notifications arrive;
 *   - with several tabs open, one tab plays per alert (Web Locks), not all of them.
 */

const MIN_GAP_MS = 1_500;
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

/** E5 then A5: two soft sine notes with a quick attack and a short decay. */
function chime(ctx: AudioContext) {
    const start = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);

    [
        { frequency: 659.25, delay: 0 },
        { frequency: 880, delay: 0.13 },
    ].forEach(({ frequency, delay }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = frequency;

        const at = start + delay;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(1, at + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);

        osc.connect(gain).connect(master);
        osc.start(at);
        osc.stop(at + 0.45);
    });
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
 * Plays the notification chime if it may play right now. Resolves to whether it did. `id` identifies the
 * alert so that only one of several open tabs plays it.
 */
export async function playNotificationSound(id?: string): Promise<boolean> {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return false;

    const now = Date.now();
    if (now - lastPlayedAt < MIN_GAP_MS) return false;

    const ctx = context;
    if (!ctx) return false; // the person has not interacted with the page yet
    if (ctx.state !== 'running') {
        void ctx.resume().catch(() => {}); // may succeed for next time; never wait for it
        return false;
    }

    lastPlayedAt = now;
    if (id && !(await claim(id))) return false;

    chime(ctx);
    return true;
}

/**
 * Plays the chime for the settings screen's "Play sample" button. Called from a click, so it may also unlock
 * audio; it ignores the politeness rules above because the person asked to hear it.
 */
export async function previewNotificationSound(): Promise<boolean> {
    const ctx = createContext();
    if (!ctx) return false;

    try {
        await ctx.resume();
    } catch {
        return false;
    }
    if (ctx.state !== 'running') return false;

    chime(ctx);
    return true;
}
