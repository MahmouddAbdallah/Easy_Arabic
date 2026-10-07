/**
 * SERVER ONLY — uses firebase-admin and the database. The `server-only` import makes the build fail if
 * a client component ever reaches it.
 *
 * `sendNotification` is the one function the rest of the project calls to push a notification.
 * Callers describe WHO and WHAT; this file validates and orchestrates, and the pieces it composes each
 * do one job (all under ./server, rules shared with the browser in policy.ts):
 *
 *   recentSends.ts — an identical send a moment ago? (accidental repeats are dropped for free)
 *   recipients.ts  — per recipient, in ONE batched read: are they already looking at the notification's page
 *                    (presence.ts), and what did they choose to be alerted about (settings.ts)?
 *   config.ts      — the admin's configuration (server/config.ts, cached, never throws): which sections exist and are
 *                    switched on, per-type urgency / time-to-live, the default icon, defaults for users who never chose
 *   policy.ts      — turns those choices into "may this push?" (paused, muted or disabled section, quiet hours)
 *   inbox.ts       — the stored copy for the in-app list + unread counter (identity.ts decides "same one")
 *   devices.ts     — which FCM tokens belong to the recipients
 *   push.ts        — FCM delivery and cleanup of dead tokens
 *
 * Notifications addressed to users (`userId` / `userIds`) are also stored in Firestore for the in-app
 * list — that copy is written even when a user has no registered device, has paused notifications or muted
 * the category, so the list never depends on push permission or on alert preferences. Pass `persist: false`
 * for a notification that should only be delivered and never stored. Push and the stored copy are
 * independent: neither waits for, or fails because of, the other.
 *
 * The stored copy follows a lifecycle (contract.ts): sending the same logical notification again
 * (same `tag`, or what its type treats as the same — see identity.ts) updates the stored copy
 * instead of adding another, and the copy is deleted when the user clicks the delivered notification.
 *
 * A user who is looking at the page the notification links to (same `link`, see presence.ts) is
 * skipped entirely — no push, no stored copy, nothing counted as unread — because the notification
 * would only repeat what is already on their screen. Without a `link`, or when addressed to raw
 * device tokens, nothing is skipped. A user who paused notifications, muted the notification's category
 * or is inside their quiet hours is not pushed to (and one who turned sound off gets a silent push),
 * but still gets the stored copy.
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
 * The same content to the same recipients twice within a few seconds is treated as an accidental repeat and
 * dropped (`duplicate: true`); give notifications that differ only in meaning something to tell them apart,
 * e.g. `data: { messageId }`.
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
import { categoryOfType, typeDelivery, type NotificationConfig } from './config';
import {
    NOTIFICATION_PAYLOAD_VERSION,
    NOTIFICATION_TYPE_CONFIG,
    type NotificationPayload,
    type NotificationType,
    type PushUrgency,
} from './contract';
import { decideAlerts } from './policy';
import { formatValidationIssues, sendNotificationSchema, type ValidatedNotificationInput } from './schema';
import { loadNotificationConfig } from './server/config';
import { getDevicesForUsers } from './server/devices';
import { notificationKey } from './server/identity';
import { saveToInbox } from './server/inbox';
import { loadMessaging, pushToDevices, type PushOutcome } from './server/push';
import { forgetSend, isRecentDuplicate, sendFingerprint } from './server/recentSends';
import { loadRecipientState, type RecipientState } from './server/recipients';
import { normalizeSettings } from './settings';

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
    /**
     * Defaults to 'general'. Sets the delivery defaults and the section a user can mute it with — both come from the
     * admin's configuration, which starts from NOTIFICATION_TYPE_CONFIG in contract.ts.
     */
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
    /**
     * Users who were stored for but not pushed to, because of their own settings: notifications paused,
     * the category muted, or quiet hours. (Not an error — it is what they asked for.)
     */
    muted: number;
    /**
     * The notification's section is switched off in the notification configuration, so nobody was alerted. (Users
     * addressed by id still got the stored copy and are counted in `muted`; a send to raw device tokens is dropped.)
     */
    disabled: boolean;
    /** The exact same send was made moments ago, so this one was dropped as an accidental repeat. */
    duplicate: boolean;
    error?: { code: NotificationErrorCode; message: string };
}

// ─── Internals ────────────────────────────────────────────────────────────────

/** FCM data messages are capped at 4096 bytes including its own envelope; stay safely under. */
const MAX_PAYLOAD_BYTES = 3500;

function result(partial: Partial<SendNotificationResult> = {}): SendNotificationResult {
    return {
        success: true,
        targeted: 0,
        sent: 0,
        failed: 0,
        removedTokens: 0,
        stored: 0,
        updated: 0,
        suppressed: 0,
        muted: 0,
        disabled: false,
        duplicate: false,
        ...partial,
    };
}

function failure(code: NotificationErrorCode, message: string, partial: Partial<SendNotificationResult> = {}) {
    return result({ ...partial, success: false, error: { code, message } });
}

/** The users the notification is addressed to (empty when it targets raw device tokens). */
function recipientUserIds(input: ValidatedNotificationInput): string[] {
    return [...new Set(input.userIds ?? (input.userId ? [input.userId] : []))];
}

/**
 * Per recipient: are they already looking at the notification's page, and what did they choose? If the
 * lookup fails nobody is held back and everyone gets the configured defaults: a duplicate notification is better than a lost one.
 */
async function loadRecipients(
    input: ValidatedNotificationInput,
    userIds: string[],
    config: NotificationConfig
): Promise<Map<string, RecipientState>> {
    if (userIds.length === 0) return new Map();

    try {
        return await loadRecipientState(userIds, input.link, config);
    } catch (error) {
        console.error('[notification] Could not load the recipients\' presence and settings:', error);
        const defaults = normalizeSettings({}, config);
        return new Map(userIds.map((userId) => [userId, { viewing: false, settings: defaults }] as const));
    }
}

/** Users who may be pushed to, split by whether their settings allow the system notification to make a sound. */
interface PushAudience {
    loud: string[];
    silent: string[];
}

interface Devices {
    loud: string[];
    silent: string[];
}

async function resolveDevices(input: ValidatedNotificationInput, audience: PushAudience): Promise<Devices> {
    if (input.token) return { loud: [input.token], silent: [] };
    if (input.tokens) return { loud: [...new Set(input.tokens)], silent: [] };
    if (audience.loud.length + audience.silent.length === 0) return { loud: [], silent: [] };

    const silentUsers = new Set(audience.silent);
    const loud: string[] = [];
    const silent: string[] = [];
    for (const { userId, fcmToken } of await getDevicesForUsers([...audience.loud, ...audience.silent])) {
        (silentUsers.has(userId) ? silent : loud).push(fcmToken);
    }
    return { loud, silent };
}

/**
 * `tag` and `key` decide how the device and the list group this notification — see NotificationPayload.
 * The service worker cannot read the configuration (it has no Firebase SDK on purpose), so what it needs from it
 * travels in the payload: here, the configured icon for senders that gave none.
 */
function buildPayload(input: ValidatedNotificationInput, grouping: { tag?: string; key?: string }, config: NotificationConfig): NotificationPayload {
    const payload: NotificationPayload = {
        v: NOTIFICATION_PAYLOAD_VERSION,
        id: randomUUID(),
        type: input.type,
        title: input.title,
        body: input.body,
        sentAt: Date.now(),
    };
    if (input.link) payload.link = input.link;
    const icon = input.icon ?? config.delivery.defaultIcon;
    if (icon) payload.icon = icon;
    if (input.image) payload.image = input.image;
    if (grouping.tag) payload.tag = grouping.tag;
    if (grouping.key) payload.key = grouping.key;
    if (input.data) {
        payload.data = Object.fromEntries(Object.entries(input.data).map(([name, value]) => [name, String(value)]));
    }
    return payload;
}

const NO_OUTCOME: PushOutcome = { sent: 0, failed: 0, removedTokens: 0, errorCodes: [] };

/** Push delivery: resolve device tokens, send through FCM (server/push.ts), forget dead tokens. */
async function sendPush(
    input: ValidatedNotificationInput,
    audience: PushAudience,
    payload: NotificationPayload,
    config: NotificationConfig
): Promise<SendNotificationResult> {
    // 1. Resolve who to send to
    let devices: Devices;
    try {
        devices = await resolveDevices(input, audience);
    } catch (error) {
        console.error('[notification] Could not load device tokens:', error);
        return failure('TOKEN_LOOKUP_FAILED', 'Could not load the recipients\' devices.');
    }
    const targeted = devices.loud.length + devices.silent.length;
    if (targeted === 0) return result(); // nobody has notifications enabled — not an error

    // 2. Send
    let messaging: Messaging;
    try {
        messaging = await loadMessaging();
    } catch (error) {
        console.error('[notification] Firebase Admin is not configured:', error);
        return failure('NOT_CONFIGURED', 'Firebase Admin could not be initialised.', { targeted });
    }

    const typeDefaults = typeDelivery(config, input.type);
    const delivery = { urgency: input.urgency ?? typeDefaults.urgency, ttlSeconds: input.ttlSeconds ?? typeDefaults.ttlSeconds };

    // Two sends at most: devices that may make a sound, and devices of people who turned sound off.
    const [audible, quiet] = await Promise.all([
        devices.loud.length > 0 ? pushToDevices(messaging, devices.loud, payload, delivery) : NO_OUTCOME,
        devices.silent.length > 0 ? pushToDevices(messaging, devices.silent, { ...payload, silent: true }, delivery) : NO_OUTCOME,
    ]);

    const outcome = {
        sent: audible.sent + quiet.sent,
        failed: audible.failed + quiet.failed,
        removedTokens: audible.removedTokens + quiet.removedTokens,
        errorCodes: [...new Set([...audible.errorCodes, ...quiet.errorCodes])],
    };
    const summary = { targeted, sent: outcome.sent, failed: outcome.failed, removedTokens: outcome.removedTokens };
    if (outcome.failed > 0) {
        const codes = outcome.errorCodes.join(', ');
        console.error(`[notification] ${outcome.failed}/${targeted} deliveries failed (${codes})`);
        return failure('DELIVERY_FAILED', `${outcome.failed} of ${targeted} deliveries failed (${codes}).`, summary);
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

    // The admin's configuration: cached, and it never throws (it falls back to what it last knew, then to the defaults).
    const config = await loadNotificationConfig();

    // 2. Build the payload once; every device (and the in-app copy) gets the same content.
    //    - `identity` says which notifications are "the same one" (identity.ts). A notification that is stored
    //      carries it as `key`, so a click can find and clear the stored copy.
    //    - A type identified by its link (a conversation) also uses it as the device `tag`, so the device shows
    //      one notification per conversation even when the caller passed no tag.
    const addressed = recipientUserIds(input);
    const identity = addressed.length > 0 ? notificationKey(input) : undefined;
    const key = input.persist ? identity : undefined;
    const tag = input.tag ?? (NOTIFICATION_TYPE_CONFIG[input.type].identity === 'link' ? identity : undefined);
    const payload = buildPayload(input, { tag, key }, config);
    const payloadBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    if (payloadBytes > MAX_PAYLOAD_BYTES) {
        const message = `Notification is too large (${payloadBytes} bytes, max ${MAX_PAYLOAD_BYTES}). Shorten the text or data.`;
        console.error(`[notification] ${message}`);
        return failure('INVALID_INPUT', message);
    }

    // 3. An accidental repeat costs nothing: drop it before touching Firestore, the database or FCM.
    const fingerprint = sendFingerprint({
        recipients: addressed.length > 0 ? addressed : [...(input.tokens ?? []), ...(input.token ? [input.token] : [])],
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
        tag: input.tag,
        data: input.data,
    });
    if (isRecentDuplicate(fingerprint)) return result({ duplicate: true });

    const outcome = await deliver(input, addressed, key, payload, config);
    if (!outcome.success) forgetSend(fingerprint); // let the caller retry
    return outcome;
}

async function deliver(
    input: ValidatedNotificationInput,
    addressed: string[],
    key: string | undefined,
    payload: NotificationPayload,
    config: NotificationConfig
): Promise<SendNotificationResult> {
    // The notification's section can be switched off for everyone in the configuration. Users addressed by id are
    // handled below like any muted section (stored, not alerted); with no user to store for there is nothing left to do.
    const section = categoryOfType(config, input.type);
    const disabled = section ? !section.enabled : false;
    if (disabled && addressed.length === 0) return result({ disabled: true });

    // 4. Leave out the users who are already looking at what the notification is about, and work out who
    //    may be pushed to. Everyone else is still stored for — alerts are a preference, the list is a record.
    const recipients = await loadRecipients(input, addressed, config);
    const reachable = addressed.filter((userId) => !recipients.get(userId)?.viewing);
    const suppressed = addressed.length - reachable.length;
    if (addressed.length > 0 && reachable.length === 0) return result({ suppressed, disabled });

    const audience: PushAudience = { loud: [], silent: [] };
    const now = Date.now();
    for (const userId of reachable) {
        const settings = recipients.get(userId)?.settings ?? normalizeSettings({}, config);
        if (decideAlerts(settings, input.type, now, config).push) (settings.sound ? audience.loud : audience.silent).push(userId);
    }
    const muted = reachable.length - audience.loud.length - audience.silent.length;

    // 5. Push and in-app copy are independent: neither waits for, or fails because of, the other.
    const noCopy = { stored: 0, updated: 0, ok: true };
    const [push, inApp] = await Promise.all([
        sendPush(input, audience, payload, config),
        key ? saveInAppCopies(reachable, key, payload) : noCopy,
    ]);

    const outcome = { ...push, stored: inApp.stored, updated: inApp.updated, suppressed, muted, disabled };
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
