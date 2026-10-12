/**
 * TEST SUPPORT — used by the *.test.ts files next to it, never by the app. Node has none of the browser pieces the
 * client modules lean on, so this file fakes them: Web Locks, localStorage, window and document.
 */

/** Resolves once every promise that is already settled (and everything chained on those) has run. */
export const settled = () => new Promise<void>((resolve) => setImmediate(resolve));

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function deferred<T = void>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

/** localStorage in memory. With `broken`, every call throws — storage that is blocked (private mode) or full. */
export class MemoryStorage {
    private readonly items = new Map<string, string>();
    private readonly broken: boolean;

    constructor({ broken = false }: { broken?: boolean } = {}) {
        this.broken = broken;
    }

    getItem(key: string): string | null {
        this.check();
        return this.items.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.check();
        this.items.set(key, String(value));
    }

    removeItem(key: string): void {
        this.check();
        this.items.delete(key);
    }

    private check() {
        if (this.broken) throw new DOMException('storage is not available', 'SecurityError');
    }
}

/**
 * `navigator.locks` for one pretend browser: exclusive locks, granted first come first served, and a request
 * whose `signal` aborts while it waits is dropped and rejected with an AbortError — as the spec says. Aborting a
 * request that was already granted does nothing.
 */
export class FakeLockManager {
    /** Names of the locks granted so far, in order. */
    readonly grants: string[] = [];
    /** The signal of the latest request that came with one. */
    lastSignal: AbortSignal | undefined;
    private readonly held = new Set<string>();
    private readonly queues = new Map<string, Array<() => void>>();

    /** How many requests for `name` are waiting for the lock. */
    waiting(name: string): number {
        return this.queues.get(name)?.length ?? 0;
    }

    request(
        name: string,
        optionsOrCallback: LockOptions | LockGrantedCallback<unknown>,
        maybeCallback?: LockGrantedCallback<unknown>
    ): Promise<unknown> {
        const options: LockOptions = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback;
        const callback = (typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback) as LockGrantedCallback<unknown>;
        if (options.signal) this.lastSignal = options.signal;

        return new Promise((resolve, reject) => {
            if (options.signal?.aborted) return reject(new DOMException('The request was aborted', 'AbortError'));

            const run = () => {
                this.held.add(name);
                this.grants.push(name);
                // As the spec has it, the lock is let go when the callback's promise settles, before the request's own
                // promise does: whoever awaits `request()` finds the lock free.
                const release = () => {
                    this.held.delete(name);
                    this.queues.get(name)?.shift()?.();
                };
                Promise.resolve()
                    .then(() => callback({ name, mode: 'exclusive' } as Lock))
                    .then(
                        (value) => {
                            release();
                            resolve(value);
                        },
                        (error: unknown) => {
                            release();
                            reject(error);
                        }
                    );
            };

            if (!this.held.has(name)) return run();

            const queue = this.queues.get(name) ?? [];
            queue.push(run);
            this.queues.set(name, queue);
            options.signal?.addEventListener('abort', () => {
                const at = queue.indexOf(run);
                if (at === -1) return; // already granted
                queue.splice(at, 1);
                reject(new DOMException('The request was aborted', 'AbortError'));
            });
        });
    }
}

/** Puts `globals` on globalThis (replacing what is there) and returns the function that puts everything back. */
export function installBrowser(globals: Record<string, unknown>): () => void {
    const saved = new Map<string, PropertyDescriptor | undefined>();
    for (const [key, value] of Object.entries(globals)) {
        saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    }
    return () => {
        for (const [key, descriptor] of saved) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete (globalThis as Record<string, unknown>)[key];
        }
    };
}
