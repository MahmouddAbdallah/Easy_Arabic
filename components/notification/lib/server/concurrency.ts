/**
 * Small helpers for fan-out work on the server: run many async jobs with a ceiling on how many are in flight, and
 * wait with jitter. No I/O of their own, no dependencies.
 *
 * Why a ceiling: a notification to a thousand people turns into dozens of Firestore reads, transactions and FCM
 * calls. Starting all of them at once opens that many sockets and holds that many buffers on one instance for no
 * gain — the backends serialise or throttle them anyway — while a bounded pool finishes just as fast and leaves the
 * instance room to serve its other requests.
 */

/**
 * Runs `task` for every item, at most `limit` at a time, and resolves — never rejects — with one settled result
 * per item, in the order of `items`. A failing task therefore never hides what the others did.
 */
export async function settleWithLimit<T, R>(
    items: readonly T[],
    limit: number,
    task: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
    const results: PromiseSettledResult<R>[] = new Array(items.length);
    let next = 0;

    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            try {
                results[index] = { status: 'fulfilled', value: await task(items[index], index) };
            } catch (reason) {
                results[index] = { status: 'rejected', reason };
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
    return results;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Exponential backoff with "equal jitter": half of the delay is fixed, half is random, so many instances that failed
 * at the same moment do not all come back at the same moment. `attempt` starts at 1.
 */
export function backoffMs(attempt: number, baseMs: number, maxMs: number, random: () => number = Math.random): number {
    const ceiling = Math.min(maxMs, baseMs * 2 ** (attempt - 1));
    return Math.round(ceiling / 2 + random() * (ceiling / 2));
}
