/**
 * SERVER ONLY — uses firebase-admin and the database. The `server-only` import makes the build fail if
 * a client component ever reaches it.
 *
 * `sendNotification` is the one function the rest of the project calls to push a notification.
 * Callers describe WHO and WHAT; this file validates and orchestrates, and the pieces it composes each
 * do one job (all under ./server):
 *
 *   presence.ts  — is the recipient already looking at the notification's page? (suppression)
 *   inbox.ts     — the stored copy for the in-app list + unread counter (identity.ts decides "same one")
 *   devices.ts   — which FCM tokens belong to the recipients
 *   push.ts      — FCM delivery and cleanup of dead tokens
 *
 * Notifications addressed to users (`userId` / `userIds`) are also stored in Firestore for the in-app
 * list — that copy is written even when a user has no registered device, so the list never depends on
 * push permission. Pass `persist: false` for a notification that should only be delivered and never stored.
 *
 * The stored copy follows a lifecycle (contract.ts): sending the same logical notification again
 * (same `tag`, or what its type treats as the same — see identity.ts) updates the stored copy
 * instead of adding another, and the copy is deleted when the user clicks the delivered notification.
 *
 * A user who is looking at the page the notification links to (same `link`, see presence.ts) is
 * skipped entirely — no push, no stored copy, nothing counted as unread — because the notification
 * would only repeat what is already on their screen. Without a `link`, or when addressed to raw
 * device tokens, nothing is skipped.
 *
 *   // to every device of one user
 *   await sendNotification({
 *       userId: receiver.id,
 *       type: 'chat_message',
 *       title: sender.name,
 *       body: 'Sent you a message',
 *       link: `/chat?receiverId=${sender.id}`,
 *       tag: `chat:${sender.id}`,            // later messages from the same sender replace this one —
 *   });                                      // on screen AND in the stored list (updated, not duplicated)
 *
 *   // delivery only — nothing is written to the `Notification` collection
 *   await sendNotification({ userId, title: 'Typing…', body: '…', persist: false });
 *
 *   // other recipient forms:  { userIds: [...] }  { token: '...' }  { tokens: [...] }
 *
 * It NEVER throws. Invalid input, a missing Firebase config, a database hiccup or an FCM outage
 * all come back as `{ success: false, error }`, so a notification can never take down the
 * request that triggered it. Check `result.success` if you care; ignore it if you don't.
 * On serverless hosts, wrap the call in `after(() => sendNotification(...))` (from "next/server")
 * to keep it off the response's critical path without the platform freezing it mid-flight.
 *
 * Keep notification text free of anything sensitive — lock screens show it to bystanders.
 */
import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Messaging } from 'firebase-admin/messaging';
import {
    NOTIFICATION_PAYLOAD_VERSION,
    NOTIFICATION_TYPE_CONFIG,
    type NotificationPayload,
    type NotificationType,
    type PushUrgency,
} from './contract';
import { getTokensForUsers } from './server/devices';
import { notificationKey } from './server/identity';
import { saveToInbox } from './server/inbox';
import { usersViewing } from './server/presence';
import { loadMessaging, pushToDevices } from './server/push';
import { formatValidationIssues, sendNotificationSchema, type ValidatedNotificationInput } from './schema';

// ─── Public types ─────────────────────────────────────────────────────────────

/** Turns `{ a, b }` into `{ a } | { b }` where the other keys are forbidden. */
type OnlyOne<T> = { [K in keyof T]: Pick<T, K> & Partial<Record<Exclude<keyof T, K>, never>> }[keyof T];

/** Exactly one way of saying who gets the notification. */
export type NotificationRecipient = OnlyOne<{
    /** All devices of one user. */
    userId: string;
    /** All devices of several users (max 1000). */
    userIds: string[];
    /** One specific FCM device token. */
    token: string;
    /** Several specific FCM device tokens (max 5000). */
    tokens: string[];
}>;

export interface NotificationContent {
    title: string;
    body: string;
    /** Defaults to 'general'. Sets delivery defaults — see NOTIFICATION_TYPE_CONFIG in contract.ts. */
    type?: NotificationType;
    /** Internal path opened when the notification is clicked, e.g. "/chat?receiverId=abc". */
    link?: string;
    /** Extra data delivered with the notification. Values are converted to strings. */
    data?: Record<string, string | number | boolean>;
    /**
     * Notifications sharing a tag replace each other instead of stacking — and for a user-addressed
     * notification, the tag is also its identity in the stored list: sending it again updates the
     * stored copy (new title/body/link/data) rather than creating another. Use one tag per logical
     * notification, e.g. `chat:${sender.id}`. Without a tag the type decides: a chat_message is
     * identified by its `link`, anything else only matches an exact repeat (see server/identity.ts).
     */
    tag?: string;
    /** Internal path or https URL. */
    icon?: string;
    /** Internal path or https URL for a large preview image. */
    image?: string;
    /** Overrides the type's default urgency. */
    urgency?: PushUrgency;
    /** Overrides the type's default time-to-live (0 – 28 days). */
    ttlSeconds?: number;
    /**
     * Keep a copy in the in-app notification list (Firestore `Notification` collection)? Defaults to
     * true. false = deliver only: nothing is stored, and clicking it has nothing to clean up. Ignored
     * for raw device tokens, which have no user to store a copy for.
     */
    persist?: boolean;
}

export type SendNotificationInput = NotificationRecipient & NotificationContent;

export type NotificationErrorCode =
    /** The input failed validation — a bug in the calling code. */
    | 'INVALID_INPUT'
    /** firebase-admin could not start (missing/invalid FIREBASE_* environment variables). */
    | 'NOT_CONFIGURED'
    /** Reading device tokens from the database failed. */
    | 'TOKEN_LOOKUP_FAILED'
    /** FCM rejected or could not deliver to at least one device. */
    | 'DELIVERY_FAILED'
    /** The in-app (Firestore) copy could not be saved. The push itself may still have gone out. */
    | 'INBOX_FAILED';

export interface SendNotificationResult {
    /**
     * true when nothing went wrong: either every device was reached, or there was nobody to
     * reach (a user with no registered devices is normal, not an error). Dead tokens that were
     * cleaned up do not count as failures.
     */
    success: boolean;
    /** Devices the notification was addressed to. */
    targeted: number;
    /** Devices FCM accepted the message for. */
    sent: number;
    /** Devices that failed for a reason other than a dead token (e.g. FCM outage). */
    failed: number;
    /** Dead device tokens FCM reported and we deleted from the database. */
    removedTokens: number;
    /**
     * In-app copies saved — one per user recipient (new or updated). 0 for token-addressed sends,
     * which have no user, and when `persist` is false.
     */
    stored: number;
    /** Of `stored`, how many refreshed an existing copy of the same notification instead of adding one. */
    updated: number;
    /** Users skipped (nothing pushed or stored) because they were already viewing the notification's `link`. */
    suppressed: number;
    error?: { code: NotificationErrorCode; message: string };
}

// ─── Internals ────────────────────────────────────────────────────────────────

/** FCM data messages are capped at 4096 bytes including its own envelope; stay safely under. */
const MAX_PAYLOAD_BYTES = 3500;

function result(partial: Partial<SendNotificationResult> = {}): SendNotificationResult {
    return { success: true, targeted: 0, sent: 0, failed: 0, removedTokens: 0, stored: 0, updated: 0, suppressed: 0, ...partial };
}

function failure(code: NotificationErrorCode, message: string, partial: Partial<SendNotificationResult> = {}) {
    return result({ ...partial, success: false, error: { code, message } });
}

/** The users the notification is addressed to (empty when it targets raw device tokens). */
function recipientUserIds(input: ValidatedNotificationInput): string[] {
    return [...new Set(input.userIds ?? (input.userId ? [input.userId] : []))];
}

/**
 * Drops the users who are already looking at the page the notification links to. If the lookup
 * fails nobody is dropped: a duplicate notification is better than a lost one.
 */
async function withoutViewers(input: ValidatedNotificationInput, userIds: string[]): Promise<string[]> {
    if (!input.link || userIds.length === 0) return userIds;

    try {
        const viewers = await usersViewing(userIds, input.link);
        return userIds.filter((userId) => !viewers.has(userId));
    } catch (error) {
        console.error('[notification] Could not check what the recipients are viewing:', error);
        return userIds;
    }
}

async function resolveTokens(input: ValidatedNotificationInput, userIds: string[]): Promise<string[]> {
    if (input.token) return [input.token];
    if (input.tokens) return [...new Set(input.tokens)];
    return getTokensForUsers(userIds);
}

/** `key` is the identity of the stored copy — pass it only when one is stored (see NotificationPayload.key). */
function buildPayload(input: ValidatedNotificationInput, key?: string): NotificationPayload {
    const payload: NotificationPayload = {
        v: NOTIFICATION_PAYLOAD_VERSION,
        id: randomUUID(),
        type: input.type,
        title: input.title,
        body: input.body,
        sentAt: Date.now(),
    };
    if (input.link) payload.link = input.link;
    if (input.icon) payload.icon = input.icon;
    if (input.image) payload.image = input.image;
    if (input.tag) payload.tag = input.tag;
    if (key) payload.key = key;
    if (input.data) {
        payload.data = Object.fromEntries(Object.entries(input.data).map(([name, value]) => [name, String(value)]));
    }
    return payload;
}

/** Push delivery: resolve device tokens, send through FCM (server/push.ts), forget dead tokens. */
async function sendPush(
    input: ValidatedNotificationInput,
    userIds: string[],
    payload: NotificationPayload
): Promise<SendNotificationResult> {
    // 1. Resolve who to send to
    let tokens: string[];
    try {
        tokens = await resolveTokens(input, userIds);
    } catch (error) {
        console.error('[notification] Could not load device tokens:', error);
        return failure('TOKEN_LOOKUP_FAILED', 'Could not load the recipients\' devices.');
    }
    if (tokens.length === 0) return result(); // nobody has notifications enabled — not an error

    // 2. Send
    let messaging: Messaging;
    try {
        messaging = await loadMessaging();
    } catch (error) {
        console.error('[notification] Firebase Admin is not configured:', error);
        return failure('NOT_CONFIGURED', 'Firebase Admin could not be initialised.', { targeted: tokens.length });
    }

    const config = NOTIFICATION_TYPE_CONFIG[input.type];
    const outcome = await pushToDevices(messaging, tokens, payload, {
        urgency: input.urgency ?? config.urgency,
        ttlSeconds: input.ttlSeconds ?? config.ttlSeconds,
    });

    const summary = { targeted: tokens.length, sent: outcome.sent, failed: outcome.failed, removedTokens: outcome.removedTokens };
    if (outcome.failed > 0) {
        const codes = outcome.errorCodes.join(', ');
        console.error(`[notification] ${outcome.failed}/${tokens.length} deliveries failed (${codes})`);
        return failure('DELIVERY_FAILED', `${outcome.failed} of ${tokens.length} deliveries failed (${codes}).`, summary);
    }
    return result(summary);
}

/**
 * The in-app copy for the notification list: created, or updated when the user already has this
 * notification. Independent of push, so it never throws.
 */
async function saveInAppCopies(userIds: string[], key: string, payload: NotificationPayload) {
    try {
        const { created, updated } = await saveToInbox(userIds, key, payload);
        return { stored: created + updated, updated, ok: true };
    } catch (error) {
        console.error('[notification] Could not save the in-app notification:', error);
        return { stored: 0, updated: 0, ok: false };
    }
}

async function run(rawInput: SendNotificationInput): Promise<SendNotificationResult> {
    // 1. Validate
    const parsed = sendNotificationSchema.safeParse(rawInput);
    if (!parsed.success) {
        const message = formatValidationIssues(parsed.error);
        console.error(`[notification] Invalid sendNotification() input — ${message}`);
        return failure('INVALID_INPUT', message);
    }
    const input = parsed.data;

    // 2. Build the payload once; every device (and the in-app copy) gets the same content. A notification
    //    that is stored carries the identity of its stored copy, so a click can find and clear it.
    const addressed = recipientUserIds(input);
    const key = input.persist && addressed.length > 0 ? notificationKey(input) : undefined;
    const payload = buildPayload(input, key);
    const payloadBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    if (payloadBytes > MAX_PAYLOAD_BYTES) {
        const message = `Notification is too large (${payloadBytes} bytes, max ${MAX_PAYLOAD_BYTES}). Shorten the text or data.`;
        console.error(`[notification] ${message}`);
        return failure('INVALID_INPUT', message);
    }

    // 3. Leave out the users who are already looking at what the notification is about.
    const userIds = await withoutViewers(input, addressed);
    const suppressed = addressed.length - userIds.length;
    if (addressed.length > 0 && userIds.length === 0) return result({ suppressed });

    // 4. Push and in-app copy are independent: neither waits for, or fails because of, the other.
    const noCopy = { stored: 0, updated: 0, ok: true };
    const [push, inApp] = await Promise.all([
        sendPush(input, userIds, payload),
        key ? saveInAppCopies(userIds, key, payload) : noCopy,
    ]);

    const outcome = { ...push, stored: inApp.stored, updated: inApp.updated, suppressed };
    if (!inApp.ok && push.success) {
        return failure('INBOX_FAILED', 'The notification was sent but could not be saved to the in-app list.', outcome);
    }
    return outcome;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function sendNotification(input: SendNotificationInput): Promise<SendNotificationResult> {
    try {
        return await run(input);
    } catch (error) {
        // Last-resort safety net — see "It NEVER throws" above.
        console.error('[notification] Unexpected error:', error);
        return failure('DELIVERY_FAILED', 'Unexpected error while sending the notification.');
    }
}
