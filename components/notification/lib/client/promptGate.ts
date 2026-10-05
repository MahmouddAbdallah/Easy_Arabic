/**
 * CLIENT ONLY (reads localStorage) — decides whether our own "turn on notifications" prompt may be shown.
 *
 * The rule: after a person dismisses or rejects the prompt — "Not now", the ×, closing the browser's own
 * dialog, or blocking notifications — it is not shown again for 7 days from THAT moment. A later dismissal
 * restarts the clock. The state is kept per user and per browser.
 *
 * Storage can be unavailable (private mode, blocked cookies): the dismissal is then remembered for the life
 * of the page, which still prevents a prompt that reappears on every navigation.
 */

export const PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** A stored time this far in the future came from a clock that was wrong; it must not silence the prompt for years. */
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

export const PROMPT_STORAGE_PREFIX = 'notification:prompt-dismissed:';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export interface PromptGate {
    /** Epoch ms of the most recent dismissal, or null. */
    lastDismissal(userId: string): number | null;
    recordDismissal(userId: string, at?: number): void;
    /** Is the prompt still resting? */
    isSuppressed(userId: string, at?: number): boolean;
    /** Epoch ms when the prompt may appear again, or null if it is not resting. */
    suppressedUntil(userId: string, at?: number): number | null;
}

export function createPromptGate(getStorage: () => StorageLike | undefined, clock: () => number = Date.now): PromptGate {
    const inMemory = new Map<string, number>();

    const lastDismissal = (userId: string): number | null => {
        let stored: number | null = null;
        try {
            const raw = getStorage()?.getItem(PROMPT_STORAGE_PREFIX + userId);
            const parsed = raw === null || raw === undefined ? NaN : Number(raw);
            if (Number.isFinite(parsed) && parsed > 0) stored = parsed;
        } catch {
            /* unavailable: fall back to memory */
        }
        const remembered = inMemory.get(userId) ?? null;
        return stored !== null && remembered !== null ? Math.max(stored, remembered) : stored ?? remembered;
    };

    const suppressedUntil = (userId: string, at = clock()): number | null => {
        const last = lastDismissal(userId);
        if (last === null || last > at + CLOCK_SKEW_TOLERANCE_MS) return null;
        const until = last + PROMPT_COOLDOWN_MS;
        return until > at ? until : null;
    };

    return {
        lastDismissal,
        suppressedUntil,
        isSuppressed: (userId, at) => suppressedUntil(userId, at) !== null,
        recordDismissal(userId, at = clock()) {
            inMemory.set(userId, at);
            try {
                getStorage()?.setItem(PROMPT_STORAGE_PREFIX + userId, String(at));
            } catch {
                /* the in-memory copy still covers this page */
            }
        },
    };
}

/** The gate the app uses: this browser's localStorage. */
export const promptGate = createPromptGate(() => {
    try {
        return typeof window === 'undefined' ? undefined : window.localStorage;
    } catch {
        return undefined; // accessing localStorage itself can throw when storage is blocked
    }
});
