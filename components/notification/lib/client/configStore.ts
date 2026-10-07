/**
 * CLIENT ONLY — browser APIs. Never import this from server code.
 *
 * The notification CONFIGURATION (../config.ts) as the browser has it: ONE shared copy for the whole app (the
 * provider, every open settings screen and the alerts all read the same one), in the same spirit as inboxStore.
 *
 *   - It starts from the copy the previous visit left in localStorage — or the built-in defaults — so the app
 *     never waits for the network to know which sections exist, and it is refreshed from
 *     GET /api/notification/config as soon as someone holds the store.
 *   - There is no polling and no listener on Firestore: the configuration changes rarely, so it is fetched again
 *     only when the person comes back to the tab and the copy is older than STALE_MS. (The server enforces the
 *     configuration with its own, shorter-lived copy, so a stale tab can at worst show a pop-up the server
 *     would no longer push for — never the other way round.)
 *   - A failed fetch keeps the copy it has: a hiccup must not change what people see.
 *
 * `apply()` is for the dashboard: right after an admin saves, their own app uses the new configuration at once.
 */
import { DEFAULT_NOTIFICATION_CONFIG, type NotificationConfig } from '../config';
import { normalizeConfig } from '../configParse';
import { fetchNotificationConfig } from './api';

const CACHE_KEY = 'notification:config';

/** How old the copy may get before coming back to the tab fetches a new one. */
export const CONFIG_STALE_MS = 5 * 60_000;

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

function writeCache(config: NotificationConfig) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(config));
    } catch {
        /* ignore */
    }
}

type Listener = () => void;

export class ConfigStore {
    private snapshot: ConfigSnapshot | undefined;
    private listeners = new Set<Listener>();
    private holders = 0;
    private inflight: Promise<void> | undefined;
    private fetchedAt = 0;
    private detach: (() => void) | undefined;

    // ─── React: useSyncExternalStore ────────────────────────────────────────────

    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    getSnapshot = (): ConfigSnapshot => (this.snapshot ??= { config: readCache() ?? DEFAULT_NOTIFICATION_CONFIG, status: 'loading' });

    getServerSnapshot = (): ConfigSnapshot => SERVER_SNAPSHOT;

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
        window.addEventListener('focus', onReturn);
        document.addEventListener('visibilitychange', onReturn);
        this.detach = () => {
            window.removeEventListener('focus', onReturn);
            document.removeEventListener('visibilitychange', onReturn);
        };
    }

    // ─── Updating ───────────────────────────────────────────────────────────────

    private refreshIfStale(): Promise<void> {
        return Date.now() - this.fetchedAt >= CONFIG_STALE_MS ? this.refresh() : Promise.resolve();
    }

    /** Fetches the configuration now. Concurrent calls share one request; never rejects. */
    refresh(): Promise<void> {
        this.inflight ??= (async () => {
            try {
                this.accept(await fetchNotificationConfig());
            } catch (error) {
                console.error('[notification] Could not load the notification configuration:', error);
                this.publish({ config: this.getSnapshot().config, status: 'error' });
            } finally {
                this.inflight = undefined;
            }
        })();
        return this.inflight;
    }

    /** Uses `config` as the current one (the dashboard calls this right after saving). */
    apply(config: NotificationConfig) {
        this.accept(config);
    }

    /** Back to the built-in defaults, as if nothing had ever been fetched (sign-out, tests). */
    dispose() {
        this.fetchedAt = 0;
        this.publish({ config: DEFAULT_NOTIFICATION_CONFIG, status: 'loading' });
    }

    private accept(config: NotificationConfig) {
        this.fetchedAt = Date.now();
        writeCache(config);
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
