/**
 * CLIENT ONLY — browser APIs. Never import this from server code.
 *
 * The notification CONFIGURATION (../config.ts) as the browser has it: ONE shared copy for the whole app (the
 * provider, every open settings screen and the alerts all read the same one), in the same spirit as inboxStore.
 *
 *   - It starts from the copy the previous visit left in localStorage — or the built-in defaults — so the app
 *     never waits for the network to know which sections exist, and it is refreshed from
 *     GET /api/notification/config as soon as someone holds the store.
 *   - There is no polling and no listener on Firestore: the configuration changes rarely, so a copy younger than
 *     STALE_MS is used as it is, and an older one is fetched again on load and when the person comes back to the tab.
 *     How old the copy is belongs to the BROWSER, not to the page: it is stored next to the copy, so reloading, or
 *     opening more tabs, does not ask again what another tab just asked. When several tabs find the copy stale
 *     together (a restored session) one of them asks, under a cross-tab lock, and the rest take its answer. What
 *     another tab stores — a fetch, or an admin saving — is picked up as it happens. (The server enforces the
 *     configuration with its own, shorter-lived copy, so a stale tab can at worst show a pop-up the server
 *     would no longer push for — never the other way round.)
 *   - A failed fetch keeps the copy it has: a hiccup must not change what people see. It is not tried again for
 *     RETRY_MS, so coming back to the tab over and over does not pile requests onto a server that is struggling.
 *
 * `apply()` is for the dashboard: right after an admin saves, their own app uses the new configuration at once.
 */
import { DEFAULT_NOTIFICATION_CONFIG, type NotificationConfig } from '../config';
import { normalizeConfig } from '../configParse';
import { fetchNotificationConfig } from './api';
import { withCrossTabLock } from './locks';

const CACHE_KEY = 'notification:config';
/** When the copy under CACHE_KEY was fetched (ms since the epoch): browser-wide, like the copy itself. */
const FETCHED_AT_KEY = 'notification:config-fetched-at';
/** Held while one tab fetches, so the others can use what it fetched. */
const FETCH_LOCK = 'notification:config';

/** How old the copy may get before it is fetched again. */
export const CONFIG_STALE_MS = 5 * 60_000;

/** How long after a failed fetch the next one waits. */
export const CONFIG_RETRY_MS = 30_000;

export interface ConfigSnapshot {
    config: NotificationConfig;
    /** `loading` until the first answer; `error` if it could not be fetched (the copy it has is kept). */
    status: 'loading' | 'ready' | 'error';
}

/** What the server renders and what hydration starts from: there is no localStorage on the server. */
const SERVER_SNAPSHOT: ConfigSnapshot = { config: DEFAULT_NOTIFICATION_CONFIG, status: 'loading' };

function readCache(): NotificationConfig | undefined {
    try {
        const stored = localStorage.getItem(CACHE_KEY);
        return stored ? normalizeConfig(JSON.parse(stored)) : undefined;
    } catch {
        return undefined;
    }
}

function readFetchedAt(): number {
    try {
        return Number(localStorage.getItem(FETCHED_AT_KEY));
    } catch {
        return 0;
    }
}

function writeCache(config: NotificationConfig, fetchedAt: number) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(config));
        localStorage.setItem(FETCHED_AT_KEY, String(fetchedAt));
    } catch {
        /* ignore */
    }
}

function forgetFetchedAt() {
    try {
        localStorage.removeItem(FETCHED_AT_KEY);
    } catch {
        /* ignore */
    }
}

type Listener = () => void;

/** What a store needs from outside — parameters so it can be exercised without a server or a clock. */
export interface ConfigStoreDeps {
    fetchConfig: () => Promise<NotificationConfig>;
    now: () => number;
}

export class ConfigStore {
    private snapshot: ConfigSnapshot | undefined;
    private listeners = new Set<Listener>();
    private holders = 0;
    private inflight: Promise<void> | undefined;
    /** This page's own record of its last fetch — what counts when localStorage is unavailable. */
    private fetchedAt = 0;
    /** No new fetch before this time (set by a failed one). */
    private retryAt = 0;
    private detach: (() => void) | undefined;
    private readonly fetchConfig: ConfigStoreDeps['fetchConfig'];
    private readonly now: ConfigStoreDeps['now'];

    constructor({ fetchConfig = fetchNotificationConfig, now = Date.now }: Partial<ConfigStoreDeps> = {}) {
        this.fetchConfig = fetchConfig;
        this.now = now;
    }

    // ─── React: useSyncExternalStore ────────────────────────────────────────────

    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    getSnapshot = (): ConfigSnapshot => (this.snapshot ??= this.initialSnapshot());

    getServerSnapshot = (): ConfigSnapshot => SERVER_SNAPSHOT;

    private initialSnapshot(): ConfigSnapshot {
        const cached = readCache();
        // A copy that is still fresh is the answer: nothing will be fetched for it.
        return { config: cached ?? DEFAULT_NOTIFICATION_CONFIG, status: cached && this.isFresh() ? 'ready' : 'loading' };
    }

    // ─── Lifetime ───────────────────────────────────────────────────────────────

    /** Keeps the configuration fresh while someone needs it. Returns the function that lets go. */
    retain = (): (() => void) => {
        this.holders += 1;
        if (this.holders === 1) this.attach();
        void this.refreshIfStale();

        let released = false;
        return () => {
            if (released) return;
            released = true;
            this.holders -= 1;
            if (this.holders === 0) {
                this.detach?.();
                this.detach = undefined;
            }
        };
    };

    private attach() {
        if (typeof window === 'undefined') return;
        const onReturn = () => {
            if (document.visibilityState === 'visible') void this.refreshIfStale();
        };
        // Another tab fetched, or an admin saved there: use its copy now. (This event only reaches the OTHER tabs.)
        const onStorage = (event: StorageEvent) => {
            if (event.key === CACHE_KEY) this.adoptStored();
        };
        window.addEventListener('focus', onReturn);
        document.addEventListener('visibilitychange', onReturn);
        window.addEventListener('storage', onStorage);
        this.detach = () => {
            window.removeEventListener('focus', onReturn);
            document.removeEventListener('visibilitychange', onReturn);
            window.removeEventListener('storage', onStorage);
        };
    }

    // ─── Updating ───────────────────────────────────────────────────────────────

    /**
     * Is the copy recent enough to use as it is? A fetch by this page or by any tab counts. A time in the future
     * (the clock was set back) or a junk value counts for nothing, and neither does a stored time whose copy is gone
     * (cleared or unreadable): there would be nothing to use, so the page has to fetch.
     */
    private isFresh(): boolean {
        const now = this.now();
        const recent = (at: number) => now - at >= 0 && now - at < CONFIG_STALE_MS;
        return recent(this.fetchedAt) || (recent(readFetchedAt()) && readCache() !== undefined);
    }

    private refreshIfStale(): Promise<void> {
        return this.load(false);
    }

    /**
     * Fetches the configuration now, even if the copy is fresh. A load that is already under way is joined rather than
     * repeated (and that one may be settled by a copy another tab has just fetched); never rejects.
     */
    refresh(): Promise<void> {
        return this.load(true);
    }

    /**
     * Brings the copy up to date; never rejects. Unless `force`d, a fresh copy is left alone (the stored one is
     * picked up, in case another tab replaced it) and so is a fetch that failed a moment ago. One request at a time
     * per page, and — under the lock — per browser.
     */
    private load(force: boolean): Promise<void> {
        if (!force) {
            if (this.isFresh()) {
                this.adoptStored();
                return Promise.resolve();
            }
            // Only the pause itself counts: with the clock set back, "30 s after the failure" must not turn into hours.
            const wait = this.retryAt - this.now();
            if (wait > 0 && wait <= CONFIG_RETRY_MS) return Promise.resolve();
        }

        this.inflight ??= withCrossTabLock(FETCH_LOCK, async () => {
            try {
                // Another tab may have fetched while this one waited for the lock: its copy is as good as a request.
                if (!force && this.isFresh()) this.adoptStored();
                else this.accept(await this.fetchConfig());
            } catch (error) {
                console.error('[notification] Could not load the notification configuration:', error);
                this.retryAt = this.now() + CONFIG_RETRY_MS;
                this.publish({ config: this.getSnapshot().config, status: 'error' });
            }
        }).finally(() => {
            this.inflight = undefined;
        });
        return this.inflight;
    }

    /** Uses `config` as the current one (the dashboard calls this right after saving). */
    apply(config: NotificationConfig) {
        this.accept(config);
    }

    /** Back to the built-in defaults, as if nothing had ever been fetched (sign-out, tests). */
    dispose() {
        this.fetchedAt = 0;
        this.retryAt = 0;
        forgetFetchedAt();
        this.publish({ config: DEFAULT_NOTIFICATION_CONFIG, status: 'loading' });
    }

    /** `config` came from the server (or the dashboard): remember it for every tab, and use it. */
    private accept(config: NotificationConfig) {
        this.fetchedAt = this.now();
        writeCache(config, this.fetchedAt);
        this.use(config);
    }

    /**
     * Takes over the copy another tab stored. Revisions only go up, so a copy older than the one held is ignored: a
     * slow fetch in another tab must not undo what an admin has just saved here.
     */
    private adoptStored() {
        const stored = readCache();
        if (stored && stored.revision >= this.getSnapshot().config.revision) this.use(stored);
    }

    private use(config: NotificationConfig) {
        const current = this.getSnapshot().config;
        // Keep the object the app already holds when nothing changed: nothing downstream re-renders for a no-op refresh.
        const same = JSON.stringify(current) === JSON.stringify(config);
        this.publish({ config: same ? current : config, status: 'ready' });
    }

    private publish(next: ConfigSnapshot) {
        const current = this.getSnapshot();
        if (current.config === next.config && current.status === next.status) return;
        this.snapshot = next;
        this.listeners.forEach((listener) => listener());
    }
}

/** The one shared copy. */
export const configStore = new ConfigStore();
