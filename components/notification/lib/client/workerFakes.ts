/**
 * TEST SUPPORT — used by serviceWorker.test.ts, never by the app. It runs the REAL `public/firebase-messaging-sw.js`
 * (read from disk, evaluated with node:vm) on fakes of what a service worker is given: the open windows (`clients`),
 * the notifications on screen (`registration`), MessageChannel, fetch and timers.
 *
 * What this shows: how the worker's own decisions play out — who it asks, what it draws, what it withdraws, where a click
 * goes. What it cannot show: how Chrome, Firefox or Safari really behave. The fakes encode the documented rules of those
 * browsers (a tag replaces a notification, `renotify` needs a tag) and nothing else; they are no substitute for trying a
 * real device.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export const ORIGIN = 'https://app.test';

/** Real-world user agent strings of the browsers the worker tells apart. */
export const USER_AGENTS = {
    chromeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    edgeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
    chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    firefoxWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
    safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    /** A web app added to the iPhone's Home Screen: no "Safari" token at all. */
    safariIosApp: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    /** Chrome on an iPhone is WebKit underneath: "CriOS", not "Chrome". */
    chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
    /** Likewise Firefox ("FxiOS", not "Firefox") … */
    firefoxIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/130.0 Mobile/15E148 Safari/605.1.15',
    /** … and Edge ("EdgiOS", not "Edg"). */
    edgeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 EdgiOS/130.0.2849.80 Mobile/15E148 Safari/605.1.15',
} as const;

// ─── What the page answers ───────────────────────────────────────────────────

export type PageReply = 'handled' | 'declined' | 'none';

export interface ClientOptions {
    url?: string;
    /** The window can be seen (not minimized, not behind everything). Default true. */
    visible?: boolean;
    /** The window is the one the person is working in (not another app). Default true. */
    focused?: boolean;
    /** `handled`: the page took the message; `declined`: it answered "not me"; `none`: no listener, no answer. Default handled. */
    reply?: PageReply;
    /** Whether this window can be navigated by the worker (only windows the worker controls can). Default false. */
    canNavigate?: boolean;
}

class FakePort {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    peer!: FakePort;

    postMessage(data: unknown) {
        queueMicrotask(() => this.peer.onmessage?.({ data }));
    }
}

class FakeMessageChannel {
    readonly port1 = new FakePort();
    readonly port2 = new FakePort();

    constructor() {
        this.port1.peer = this.port2;
        this.port2.peer = this.port1;
    }
}

/** An open window of the app, as `clients.matchAll()` hands it to the worker. */
export class FakeClient {
    url: string;
    visibilityState: 'visible' | 'hidden';
    focused: boolean;
    /** Every message the worker posted to this window. */
    readonly received: unknown[] = [];
    readonly navigations: string[] = [];
    focusCalls = 0;
    navigate?: (url: string) => Promise<FakeClient>;
    private readonly reply: PageReply;

    constructor({ url = `${ORIGIN}/`, visible = true, focused = true, reply = 'handled', canNavigate = false }: ClientOptions = {}) {
        this.url = url;
        this.visibilityState = visible ? 'visible' : 'hidden';
        this.focused = visible && focused;
        this.reply = reply;
        if (canNavigate) {
            this.navigate = async (target) => {
                this.navigations.push(target);
                this.url = target;
                return this;
            };
        }
    }

    postMessage(message: unknown, transfer?: unknown[]) {
        // A browser hands the page a structured clone, never the worker's own object — and the clone is what lets a test
        // compare it: the worker runs in its own vm realm, so its objects would not equal the test's even when identical.
        this.received.push(structuredClone(message));
        const port = transfer?.[0] as FakePort | undefined;
        if (this.reply === 'none' || !port) return;
        port.postMessage({ handled: this.reply === 'handled' });
    }

    focus() {
        this.focusCalls += 1;
        this.focused = true;
        this.visibilityState = 'visible';
        return Promise.resolve(this);
    }
}

// ─── Notifications on screen ─────────────────────────────────────────────────

type NotificationOptions = Record<string, unknown> & { tag?: string; renotify?: boolean; data?: Record<string, unknown> };

export class FakeNotification {
    constructor(
        readonly title: string,
        readonly options: NotificationOptions,
        private readonly screen: FakeRegistration
    ) {}

    get tag(): string {
        return this.options.tag ?? '';
    }

    get data(): Record<string, unknown> | undefined {
        return this.options.data;
    }

    close() {
        this.screen.remove(this);
    }
}

/** `self.registration`: draws notifications. A notification with the tag of one already shown replaces it. */
export class FakeRegistration {
    /** Every `showNotification` call that was accepted, in order — including those that were taken back later. */
    readonly log: Array<{ title: string; options: NotificationOptions }> = [];
    /** What is on screen now. */
    readonly onScreen: FakeNotification[] = [];
    /** Notifications that were closed (by the worker or the person). */
    readonly closed: FakeNotification[] = [];
    /** Makes `showNotification` reject for options the predicate does not like — a browser refusing an option. */
    refuse?: (options: NotificationOptions) => Error | undefined;

    async showNotification(title: string, options: NotificationOptions = {}): Promise<void> {
        if (options.renotify && !options.tag) {
            throw new TypeError('Notifications which set the renotify flag must specify a non-empty tag');
        }
        const refusal = this.refuse?.(options);
        if (refusal) throw refusal;

        // `data` is serialized by the browser; cloning the whole dictionary gives the same plain values (and see FakeClient).
        const stored = structuredClone(options);
        this.log.push({ title, options: stored });
        if (stored.tag) {
            const replaced = this.onScreen.findIndex((shown) => shown.tag === stored.tag);
            if (replaced !== -1) this.onScreen.splice(replaced, 1);
        }
        this.onScreen.push(new FakeNotification(title, stored, this));
    }

    async getNotifications(filter: { tag?: string } = {}): Promise<FakeNotification[]> {
        return this.onScreen.filter((shown) => filter.tag === undefined || shown.tag === filter.tag);
    }

    remove(notification: FakeNotification) {
        const at = this.onScreen.indexOf(notification);
        if (at === -1) return;
        this.onScreen.splice(at, 1);
        this.closed.push(notification);
    }
}

// ─── Time ────────────────────────────────────────────────────────────────────

/** setTimeout under the test's control: nothing fires until `advance`. */
export class FakeTimers {
    private now = 0;
    private nextId = 1;
    private readonly pending = new Map<number, { at: number; run: () => void }>();

    setTimeout = (run: () => void, ms = 0): number => {
        const id = this.nextId++;
        this.pending.set(id, { at: this.now + ms, run });
        return id;
    };

    clearTimeout = (id?: number): void => {
        if (id !== undefined) this.pending.delete(id);
    };

    /** How many timers are waiting. */
    get waiting(): number {
        return this.pending.size;
    }

    advance(ms: number): void {
        const until = this.now + ms;
        for (;;) {
            const due = [...this.pending.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
            if (!due) break;
            this.now = Math.max(this.now, due[1].at);
            this.pending.delete(due[0]);
            due[1].run();
        }
        this.now = until;
    }
}

// ─── The worker ──────────────────────────────────────────────────────────────

const WORKER_FILE = path.resolve(process.cwd(), 'public/firebase-messaging-sw.js');

type Listener = (event: Record<string, unknown>) => void;

interface FetchInit {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    credentials?: string;
}

export interface LoadedWorker {
    registration: FakeRegistration;
    timers: FakeTimers;
    /** The windows the worker can see. Push or remove entries to change what is open. */
    clients: FakeClient[];
    /** URLs passed to `clients.openWindow`. */
    opened: string[];
    /** Requests the worker made with fetch. */
    requests: Array<{ url: string; init?: FetchInit }>;
    /** A push arrives; `raw` is what `event.data.json()` returns (a function that throws means "not JSON"). Resolves when the worker is done with it. */
    push(raw: unknown): Promise<void>;
    /** A push with no body at all. */
    pushEmpty(): Promise<void>;
    /** The person clicks a notification that is on screen. Resolves when the worker is done with the click. */
    click(notification: FakeNotification): Promise<void>;
}

/** Evaluates the real worker file on the fakes. `userAgent` is what `self.navigator.userAgent` answers. */
export function loadWorker({ userAgent, clients = [] }: { userAgent: string; clients?: FakeClient[] }): LoadedWorker {
    const timers = new FakeTimers();
    const registration = new FakeRegistration();
    const opened: string[] = [];
    const requests: LoadedWorker['requests'] = [];
    const listeners = new Map<string, Listener[]>();

    const dispatch = (type: string, event: Record<string, unknown>): Promise<void> => {
        const promises: Array<Promise<unknown>> = [];
        const full = { ...event, waitUntil: (promise: Promise<unknown>) => void promises.push(Promise.resolve(promise)) };
        for (const listener of listeners.get(type) ?? []) listener(full);
        return Promise.all(promises).then(() => undefined);
    };

    const self = {
        addEventListener: (type: string, listener: Listener) => listeners.set(type, [...(listeners.get(type) ?? []), listener]),
        skipWaiting: () => Promise.resolve(),
        clients: {
            matchAll: async () => [...clients],
            claim: async () => undefined,
            openWindow: async (url: string) => {
                opened.push(url);
                return null;
            },
        },
        registration,
        location: { origin: ORIGIN },
        navigator: { userAgent },
    };

    const sandbox = {
        self,
        MessageChannel: FakeMessageChannel,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
        fetch: async (url: string, init?: FetchInit) => {
            requests.push({ url, init });
            return { ok: true };
        },
        URL,
        console,
    };
    vm.runInNewContext(readFileSync(WORKER_FILE, 'utf8'), sandbox, { filename: 'firebase-messaging-sw.js' });

    return {
        registration,
        timers,
        clients,
        opened,
        requests,
        push: (raw) =>
            dispatch('push', {
                data: {
                    json: () => {
                        if (typeof raw === 'function') return raw();
                        return raw;
                    },
                },
            }),
        pushEmpty: () => dispatch('push', { data: null }),
        click: (notification) => dispatch('notificationclick', { notification }),
    };
}

// ─── Payloads ────────────────────────────────────────────────────────────────

export interface TestPayload {
    v: 1;
    id: string;
    type: string;
    title: string;
    body: string;
    link?: string;
    icon?: string;
    image?: string;
    tag?: string;
    key?: string;
    silent?: boolean;
    sentAt: number;
}

/** A notification as sendNotification() builds it (a chat message from Ali). */
export function samplePayload(overrides: Partial<TestPayload> = {}): TestPayload {
    return {
        v: 1,
        id: 'send-1',
        type: 'chat_message',
        title: 'Ali',
        body: 'Sent you a message',
        link: '/chat?receiverId=ali',
        tag: 'chat:ali',
        key: 'a'.repeat(64),
        sentAt: 1_760_000_000_000,
        ...overrides,
    };
}

/** What FCM puts in the web push body for a data-only message with our `payload` key. */
export function fcmEnvelope(payload: object) {
    return { from: '1234567890', priority: 'high', data: { payload: JSON.stringify(payload) }, fcmMessageId: 'fcm-1' };
}
