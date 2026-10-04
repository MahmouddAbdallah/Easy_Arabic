/**
 * Firebase Cloud Messaging service worker.
 *
 * firebase `getToken()` registers this file automatically (scope: /firebase-cloud-messaging-push-scope)
 * and FCM delivers every push to it. It is the ONE place that draws notifications:
 *
 *   push arrives ──▶ a page of the app is visible? ──yes──▶ hand it to the page (in-app toast)
 *                                                  └──no───▶ show a system notification
 *   system notification clicked ──▶ tell the server it was handled (its stored copy is deleted),
 *                                   focus the app and go to the notification's `link`
 *   system notification dismissed / ignored ──▶ nothing: its stored copy stays, unread, in the list
 *
 * The messages are FCM *data-only* messages built by sendNotification(), so the Firebase SDK never
 * draws a second copy. Notifications that share a `tag` replace each other, which also absorbs
 * any duplicate delivery of the same push.
 *
 * No Firebase SDK is loaded here: this is plain Web Push handling, so there are no CDN scripts or
 * config values to keep in sync. The payload contract lives in components/notification/lib/contract.ts —
 * keep MESSAGE / PAYLOAD_KEY / PAYLOAD_VERSION / HANDLED_ENDPOINT below identical to it.
 */
'use strict';

const MESSAGE = { RECEIVED: 'NOTIFICATION_RECEIVED', CLICK: 'NOTIFICATION_CLICK' };
const PAYLOAD_KEY = 'payload';
const PAYLOAD_VERSION = 1;
const HANDLED_ENDPOINT = '/api/notification/handled';

/** Shown when a notification doesn't specify its own icon (system notifications need PNG/JPEG — SVG is not supported). */
const DEFAULT_ICON = '/icons/notification-icon.png';

/** How long to wait for a page to confirm it handled a message before falling back. */
const PAGE_REPLY_TIMEOUT_MS = 1000;

// Take over immediately when this file changes, instead of waiting for every tab to close.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => event.waitUntil(handlePush(event)));
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const data = event.notification.data || {};
    // Side by side: opening the app never waits for the report, and the report is best-effort (it never rejects).
    event.waitUntil(Promise.all([markHandled(data.key), openApp(toAppPath(data.link))]));
});

// ─── Incoming push ────────────────────────────────────────────────────────────

async function handlePush(event) {
    const payload = readPayload(event);
    if (!payload) return;

    // Only a *visible* page can show an in-app toast; background tabs can't be seen.
    const visiblePages = (await getWindowClients()).filter((client) => client.visibilityState === 'visible');

    if (visiblePages.length > 0) {
        const replies = await Promise.all(
            visiblePages.map((client) => askPage(client, { type: MESSAGE.RECEIVED, payload }))
        );
        // If a visible page has no listener (e.g. notifications aren't mounted on that route),
        // nobody confirmed — fall through so the user still sees the notification.
        if (replies.some(Boolean)) return;
    }

    await showSystemNotification(payload);
}

function showSystemNotification(payload) {
    return self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: payload.icon || DEFAULT_ICON,
        image: payload.image,
        // Same tag = replace instead of stack. Untagged notifications get their unique id, so they stack.
        tag: payload.tag || payload.id,
        renotify: Boolean(payload.tag), // buzz again when a tagged notification is replaced (needs a tag)
        dir: 'auto', // Arabic and English text both lay out correctly
        timestamp: payload.sentAt,
        data: { link: toAppPath(payload.link), id: payload.id, type: payload.type, key: payload.key },
    });
}

/** Reads the push into a payload object, or null if it isn't something we can display. */
function readPayload(event) {
    if (!event.data) return null;

    let raw;
    try {
        raw = event.data.json();
    } catch (_) {
        return null;
    }
    if (!raw || typeof raw !== 'object') return null;

    // 1. Our own format: JSON under data.payload (see sendNotification).
    const encoded = raw.data && raw.data[PAYLOAD_KEY];
    if (typeof encoded === 'string') {
        try {
            const payload = JSON.parse(encoded);
            if (isPayload(payload)) return payload;
        } catch (_) {
            /* fall through */
        }
    }

    // 2. A plain FCM "notification" message (e.g. a test sent from the Firebase console).
    const n = raw.notification;
    if (n && (n.title || n.body)) {
        return {
            v: PAYLOAD_VERSION,
            id: String(raw.fcmMessageId || Date.now()),
            type: 'general',
            title: String(n.title || ''),
            body: String(n.body || ''),
            link: (raw.fcmOptions && raw.fcmOptions.link) || (raw.data && raw.data.link) || undefined,
            icon: n.icon,
            image: n.image,
            tag: n.tag,
            sentAt: Date.now(),
        };
    }

    return null;
}

function isPayload(p) {
    return (
        p &&
        p.v === PAYLOAD_VERSION &&
        typeof p.id === 'string' &&
        typeof p.title === 'string' &&
        typeof p.body === 'string'
    );
}

// ─── Notification click ───────────────────────────────────────────────────────

async function openApp(path) {
    const pages = await getWindowClients();

    // Prefer a page already showing the target, then a visible one, then any open page.
    const target =
        pages.find((client) => toAppPath(client.url) === path) ||
        pages.find((client) => client.visibilityState === 'visible') ||
        pages[0];

    if (target) {
        try {
            await target.focus();
        } catch (_) {
            /* focusing can be refused; carry on */
        }
        if (toAppPath(target.url) === path) return; // already there

        // Best: let the page navigate itself (instant, keeps app state, no reload).
        if (await askPage(target, { type: MESSAGE.CLICK, link: path })) return;

        // The page has no listener. Navigate it directly (only allowed for pages this worker controls)…
        if (typeof target.navigate === 'function') {
            try {
                await target.navigate(absolute(path));
                return;
            } catch (_) {
                /* not controlled by this worker — open a window instead */
            }
        }
    }

    await self.clients.openWindow(absolute(path));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Tells the server the user clicked the notification identified by `key` (present only when a copy of it
 * was stored), so that copy is deleted. The request is same-origin, so the session cookie goes with it.
 * Best-effort: on any failure the notification just stays in the list as unread. Never rejects.
 */
function markHandled(key) {
    if (typeof key !== 'string' || !key) return Promise.resolve();

    return fetch(HANDLED_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
        credentials: 'same-origin',
    }).then(
        () => undefined,
        () => undefined
    );
}

function getWindowClients() {
    // includeUncontrolled: pages are not controlled by this worker (its scope is Firebase's own).
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
}

/**
 * Posts a message to a page and resolves true if the page confirms it handled it
 * (NotificationProvider replies on the MessageChannel), false on timeout or error.
 */
function askPage(client, message) {
    return new Promise((resolve) => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => resolve(false), PAGE_REPLY_TIMEOUT_MS);

        channel.port1.onmessage = (reply) => {
            clearTimeout(timer);
            resolve(Boolean(reply.data && reply.data.handled));
        };

        try {
            client.postMessage(message, [channel.port2]);
        } catch (_) {
            clearTimeout(timer);
            resolve(false);
        }
    });
}

/** Normalises any link to a same-origin "/path?query"; anything else (other origins, junk) becomes "/". */
function toAppPath(link) {
    try {
        const url = new URL(link || '/', self.location.origin);
        if (url.origin !== self.location.origin) return '/';
        return url.pathname + url.search;
    } catch (_) {
        return '/';
    }
}

function absolute(path) {
    return new URL(path, self.location.origin).href;
}
