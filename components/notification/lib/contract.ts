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
 *   a user already viewing `link` is skipped before any of this happens (see ACTIVE_CONTEXT_* below)
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

/**
 * What a user can mute (see settings.ts). Types are many and grow; categories are the few things a person
 * understands ("messages", "lessons"), so settings are keyed by category and each type maps to one.
 */
export const NOTIFICATION_CATEGORIES = ['messages', 'lessons', 'account', 'general'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** Web Push urgency header (RFC 8030). 'high' wakes sleeping devices sooner. */
export type PushUrgency = 'very-low' | 'low' | 'normal' | 'high';

export interface NotificationTypeConfig {
    /** Which user-facing setting mutes this type (see settings.ts / policy.ts). */
    category: NotificationCategory;
    urgency: PushUrgency;
    /** How long FCM keeps the message for an offline device before dropping it. */
    ttlSeconds: number;
    /**
     * What makes two notifications of this type "the same one" when the caller gave no `tag`
     * (see lib/server/identity.ts): 'link' — the same `link` (one conversation, one notification, whatever
     * its latest text), or 'content' — only an exact repeat.
     */
    identity: 'link' | 'content';
}

const ONE_DAY = 24 * 60 * 60;

/** Per-type delivery defaults. A caller can still override them per call. */
export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, NotificationTypeConfig> = {
    general: { category: 'general', urgency: 'normal', ttlSeconds: ONE_DAY, identity: 'content' },
    chat_message: { category: 'messages', urgency: 'high', ttlSeconds: ONE_DAY, identity: 'link' },
    lesson: { category: 'lessons', urgency: 'normal', ttlSeconds: ONE_DAY, identity: 'content' },
    create_account: { category: 'account', urgency: 'high', ttlSeconds: ONE_DAY, identity: 'content' },
    sign_in: { category: 'account', urgency: 'low', ttlSeconds: ONE_DAY, identity: 'content' }
};

/** Where the browser registers its FCM token (see app/api/notification/fcm-token). */
export const FCM_TOKEN_ENDPOINT = '/api/notification/fcm-token';

// ─── In-app notification list (separate from push) ────────────────────────────
// A user-addressed sendNotification() also stores one document per recipient in this Firestore
// collection (lib/server/inbox.ts) — unless the caller passes `persist: false`. NotificationBody reads
// them back in real time, so the list works whether or not the user ever granted push permission.
//
// ── Lifecycle of a stored notification ──
//   sent                                   → stored, unread (a copy is stored even if the user has no device)
//   sent again, same logical notification  → the stored document is UPDATED in place (new content, back on
//                                            top, unread again, `count` +1 while it stayed unread) — never
//                                            duplicated. What "same" means is decided in lib/server/identity.ts.
//   delivered, user ignores or dismisses   → stays stored, unread: it is still unhandled
//   delivered, user clicks it              → the stored document is DELETED: it was handled and has no
//                                            reason to linger (see NOTIFICATION_HANDLED_ENDPOINT)
//   "Mark as read" in the list             → the document stays, flagged read (the list is its own history) and
//                                            gets an `expireAt` — a Firestore TTL policy on that field prunes
//                                            READ notifications only, so the unread counter can never drift

export const NOTIFICATION_COLLECTION = 'Notification';

/** Marks notifications as read (see app/api/notification/read). */
export const NOTIFICATION_READ_ENDPOINT = '/api/notification/read';

/**
 * Reports that the user clicked a delivered notification (a toast or a system notification), so its
 * stored copy is deleted (see app/api/notification/handled). The service worker calls it too — keep
 * the path in public/firebase-messaging-sw.js identical.
 */
export const NOTIFICATION_HANDLED_ENDPOINT = '/api/notification/handled';

/**
 * unreadNotificationCount (collection) └── {userId} (document) -> { count: number }
 *
 * How many of the user's stored notifications are unread. Kept in step with the `Notification`
 * collection by lib/server/inbox.ts (every create / mark-as-read updates both in one transaction),
 * so a badge can listen to this single document instead of counting the list. The document does not
 * exist until the user's first notification — read a missing document as 0.
 */
export const UNREAD_COUNT_COLLECTION = 'unreadNotificationCount';

// ─── What the user is looking at right now ────────────────────────────────────
// A notification whose `link` is the page a user is already viewing tells them nothing new, so
// sendNotification() skips such users entirely (no push, no stored copy). Only the server can make
// that call, so a tab that is visible reports its location to this endpoint (see lib/client/presence.ts).
//
// There is NO heartbeat. A report is sent when something actually changes — the page settles, the tab
// becomes visible or hidden, or the user interacts after the previous report has aged past
// ACTIVE_CONTEXT_REFRESH_MS — and every report is trusted for ACTIVE_CONTEXT_TTL_MS. So the entry of a
// tab that is open but untouched simply lapses: someone who walked away from /chat is treated as not
// "actively viewing" it and is notified, which is also the safe failure (a crash or a lost connection
// can never hide a notification for longer than the TTL). An idle tab costs nothing, an active one costs
// at most one request per REFRESH interval.
//
// REFRESH must be at most half of TTL, so a user who keeps interacting is covered without a gap.

export const ACTIVE_CONTEXT_ENDPOINT = '/api/notification/context';
export const ACTIVE_CONTEXT_TTL_MS = 5 * 60_000;
export const ACTIVE_CONTEXT_REFRESH_MS = 150_000;

// ─── Notification settings (per user) ─────────────────────────────────────────
// One document per user, `notificationSettings/{userId}` (shape: settings.ts). The browser only READS it
// (live, so a change made in one tab or device applies everywhere at once); every change goes through
// NOTIFICATION_SETTINGS_ENDPOINT, which validates it. sendNotification() reads it too — in the same
// round trip as the presence check — to decide whether to push (policy.ts); the in-app list is always
// written, so pausing or muting never loses a notification, it only silences the alert.

export const NOTIFICATION_SETTINGS_COLLECTION = 'notificationSettings';
export const NOTIFICATION_SETTINGS_ENDPOINT = '/api/notification/settings';

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
    /** How many sends this (still unread) notification stands for — "3 new messages". Always ≥ 1. */
    count: number;
    /** Identity of the notification (NotificationPayload.key); what a click reports to NOTIFICATION_HANDLED_ENDPOINT. */
    key?: string;
    /** Id of the latest send (NotificationPayload.id) — lets the page recognise a push it already showed. */
    sendId?: string;
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
    /**
     * Notifications with the same tag replace each other instead of stacking (and the service worker counts
     * them: "Ali (3)"). Set from the caller's `tag`, or — for types identified by their link — from the
     * stored copy's identity, so a conversation is one notification on the device as well as in the list.
     */
    tag?: string;
    /** The recipient turned sound off: show the system notification without sound or vibration. */
    silent?: boolean;
    /** Free-form extra data for the app (all values are strings). */
    data?: Record<string, string>;
    /**
     * Identity of the stored copy of this notification (lib/server/identity.ts). Only present when a
     * copy was stored; sent back to NOTIFICATION_HANDLED_ENDPOINT when the user clicks the notification.
     */
    key?: string;
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
    if (p.silent !== undefined && typeof p.silent !== 'boolean') return null;
    if (p.key !== undefined && typeof p.key !== 'string') return null;
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
