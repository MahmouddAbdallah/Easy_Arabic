/**
 * CLIENT ONLY — browser APIs. Never import this from server code.
 *
 * One tab at a time for work that every tab would otherwise do for itself. `withCrossTabLock` runs a task while
 * it holds a Web Lock: of all the tabs of this browser asking for the same lock at once, one runs the task and each
 * of the others runs it afterwards — and can first look at what the earlier one left behind (a marker, a stored
 * copy) and find there is nothing left to do. The lock is released when the task settles, and by the browser
 * if the tab holding it goes away.
 *
 * It never holds anything up for longer than `waitMs`. Without Web Locks (old browsers, an insecure page, a sandboxed
 * frame), or when the lock cannot be had within that time (the tab holding it is stuck), the task simply runs
 * unlocked, as it would have before — so the most a stuck holder costs a waiting tab is the wait. What the task
 * returns or throws comes out unchanged.
 */

/** The part of `navigator.locks` used here. */
export type LockProvider = Pick<LockManager, 'request'>;

/** How long to wait for a lock another tab holds before going ahead without it. */
export const LOCK_WAIT_MS = 10_000;

export interface CrossTabLockOptions {
    /** Where locks come from: `navigator.locks`. A parameter so the logic can be exercised without a browser. */
    locks?: LockProvider;
    waitMs?: number;
}

export async function withCrossTabLock<T>(name: string, task: () => Promise<T>, options: CrossTabLockOptions = {}): Promise<T> {
    const { locks = typeof navigator === 'undefined' ? undefined : navigator.locks, waitMs = LOCK_WAIT_MS } = options;
    if (!locks) return task();

    // Only the wait is bounded: once the lock is granted the timer is gone and the task takes as long as it takes.
    const waiting = new AbortController();
    const timer = setTimeout(() => waiting.abort(), waitMs);
    let started = false;
    try {
        return await locks.request(name, { signal: waiting.signal }, () => {
            started = true;
            clearTimeout(timer);
            return task();
        });
    } catch (error) {
        clearTimeout(timer);
        if (started) throw error; // the task's own failure, not the lock's
        return task(); // never got the lock (timed out, or the browser refused): do the work anyway
    }
}
