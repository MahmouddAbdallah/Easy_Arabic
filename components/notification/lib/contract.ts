/**
 * Notification contract — shared by the server (`sendNotification`), the client
 * (`NotificationProvider`, `NotificationBody`) and the service worker (`public/firebase-messaging-sw.js`).
 *
 * This file has NO server or browser imports, so it is safe to import from anywhere.
 * The service worker is plain JS and cannot import it: if you change the wire format
 * (payload shape, message names, payload key) mirror the change in that file.
 *
 * ── How a notification travels ─────────────────────────────────────────────────
 *   sendNotification()  ──FCM data-only message──▶  service worker
 *     • no page visible  → the service worker shows a system notification
 *     • page visible     → the service worker hands it to the page, which shows an in-app toast
 *   click on a system notification → the service worker focuses / opens the app at `link`
 *
 * The message is *data-only* on purpose: FCM's own "notification" messages are rendered by
 * the Firebase SDK and give us no control over clicks or de-duplication (and double-render if
 * the app also draws one). With data-only, the service worker is the single place that draws.
 *
 * ── Adding a new notification type ─────────────────────────────────────────────
 *   1. Add its name to NOTIFICATION_TYPES.
 *   2. Add its defaults to NOTIFICATION_TYPE_CONFIG (TypeScript will refuse to compile until you do).
 *   3. Call sendNotification({ type: 'your_type', ... }).
 */

export const NOTIFICATION_TYPES = ['general', 'chat_message', 'lesson', 'sign_in', 'create_account'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Web Push urgency header (RFC 8030). 'high' wakes sleeping devices sooner. */
export type PushUrgency = 'very-low' | 'low' | 'normal' | 'high';

export interface NotificationTypeConfig {
    urgency: PushUrgency;
    /** How long FCM keeps the message for an offline device before dropping it. */
    ttlSeconds: number;
}

const ONE_DAY = 24 * 60 * 60;

/** Per-type delivery defaults. A caller can still override them per call. */
export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, NotificationTypeConfig> = {
    general: { urgency: 'normal', ttlSeconds: ONE_DAY },
    chat_message: { urgency: 'high', ttlSeconds: ONE_DAY },
    lesson: { urgency: 'normal', ttlSeconds: ONE_DAY },
    create_account: { urgency: 'high', ttlSeconds: ONE_DAY },
    sign_in: { urgency: 'low', ttlSeconds: ONE_DAY }
};

/** Where the browser registers its FCM token (see app/api/notification/fcm-token). */
export const FCM_TOKEN_ENDPOINT = '/api/notification/fcm-token';

// ─── In-app notification list (separate from push) ────────────────────────────
// Every user-addressed sendNotification() also stores one document per recipient in this Firestore
// collection (lib/inbox.server.ts). NotificationBody reads them back in real time, so the list
// works whether or not the user ever granted push permission.

export const NOTIFICATION_COLLECTION = 'Notification';

/** Marks notifications as read (see app/api/notification/read). */
export const NOTIFICATION_READ_ENDPOINT = '/api/notification/read';

/** A stored notification as the list shows it. */
export interface InAppNotification {
    /** Firestore document id. */
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    /** Same-origin path to open on click. */
    link?: string;
    isRead: boolean;
    /** Epoch milliseconds. */
    createdAt: number;
}

/** The single FCM `data` key that carries the JSON-encoded NotificationPayload. */
export const NOTIFICATION_PAYLOAD_KEY = 'payload';
export const NOTIFICATION_PAYLOAD_VERSION = 1;

/** Messages the service worker posts to open pages. */
export const SW_MESSAGE = {
    /** A notification arrived while a page is visible — show it in-app. */
    RECEIVED: 'NOTIFICATION_RECEIVED',
    /** A system notification was clicked — navigate to `link`. */
    CLICK: 'NOTIFICATION_CLICK',
} as const;

/** What actually travels inside the FCM message (JSON-encoded under NOTIFICATION_PAYLOAD_KEY). */
export interface NotificationPayload {
    v: typeof NOTIFICATION_PAYLOAD_VERSION;
    /** Unique per sendNotification() call; shared by every device it targets. */
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    /** Same-origin path to open on click, e.g. "/chat?receiverId=abc". */
    link?: string;
    icon?: string;
    image?: string;
    /** Notifications with the same tag replace each other instead of stacking. */
    tag?: string;
    /** Free-form extra data for the app (all values are strings). */
    data?: Record<string, string>;
    /** Epoch milliseconds. */
    sentAt: number;
}

export type ServiceWorkerMessage =
    | { type: typeof SW_MESSAGE.RECEIVED; payload: NotificationPayload }
    | { type: typeof SW_MESSAGE.CLICK; link: string };

// ─── Safety helpers ───────────────────────────────────────────────────────────

/**
 * A link is only allowed to point inside this app: it must start with a single "/" (so no
 * "//evil.com" protocol-relative URLs), and contain no backslashes (browsers treat "\" as "/")
 * or whitespace/control characters.
 */
export function isSafeInternalLink(value: unknown): value is string {
    return typeof value === 'string' && value.length <= 2000 && /^\/(?![/\\])[^\s\\]*$/.test(value);
}

/** Icons/images may be an internal path or an https URL — never http:, data:, javascript: etc. */
export function isSafeAssetUrl(value: unknown): value is string {
    if (typeof value !== 'string' || value.length > 2000) return false;
    return isSafeInternalLink(value) || /^https:\/\/[^\s\\]+$/.test(value);
}

// ─── Runtime parsing (for data that crosses a trust boundary) ─────────────────

function isStringRecord(value: unknown): value is Record<string, string> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.values(value).every((v) => typeof v === 'string')
    );
}

export function parseNotificationPayload(raw: unknown): NotificationPayload | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const p = raw as Record<string, unknown>;

    if (p.v !== NOTIFICATION_PAYLOAD_VERSION) return null;
    if (typeof p.id !== 'string' || typeof p.title !== 'string' || typeof p.body !== 'string') return null;
    if (!NOTIFICATION_TYPES.includes(p.type as NotificationType)) return null;
    if (typeof p.sentAt !== 'number') return null;
    if (p.link !== undefined && !isSafeInternalLink(p.link)) return null;
    if (p.tag !== undefined && typeof p.tag !== 'string') return null;
    if (p.icon !== undefined && !isSafeAssetUrl(p.icon)) return null;
    if (p.image !== undefined && !isSafeAssetUrl(p.image)) return null;
    if (p.data !== undefined && !isStringRecord(p.data)) return null;

    return p as unknown as NotificationPayload;
}

export function parseServiceWorkerMessage(raw: unknown): ServiceWorkerMessage | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const m = raw as Record<string, unknown>;

    if (m.type === SW_MESSAGE.RECEIVED) {
        const payload = parseNotificationPayload(m.payload);
        return payload ? { type: SW_MESSAGE.RECEIVED, payload } : null;
    }
    if (m.type === SW_MESSAGE.CLICK && isSafeInternalLink(m.link)) {
        return { type: SW_MESSAGE.CLICK, link: m.link };
    }
    return null;
}
