/**
 * SERVER ONLY — uses firebase-admin and the database. Never import this from a client component.
 *
 * `sendNotification` is the one function the rest of the project calls to push a notification.
 * Callers describe WHO and WHAT; token lookup, FCM payloads, batching and cleanup of dead
 * device tokens all happen in here.
 *
 *   // to every device of one user
 *   await sendNotification({
 *       userId: receiver.id,
 *       type: 'chat_message',
 *       title: sender.name,
 *       body: 'Sent you a message',
 *       link: `/chat?receiverId=${sender.id}`,
 *       tag: `chat:${sender.id}`,            // later messages from the same sender replace this one
 *   });
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
import { randomUUID } from 'node:crypto';
import type { Messaging } from 'firebase-admin/messaging';
import {
    NOTIFICATION_PAYLOAD_KEY,
    NOTIFICATION_PAYLOAD_VERSION,
    NOTIFICATION_TYPE_CONFIG,
    type NotificationPayload,
    type NotificationType,
    type PushUrgency,
} from './contract';
import { formatValidationIssues, sendNotificationSchema, type ValidatedNotificationInput } from './schema';
import { deleteTokens, getTokensForUsers } from './tokens.server';

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
    /** Notifications sharing a tag replace each other instead of stacking. */
    tag?: string;
    /** Internal path or https URL. */
    icon?: string;
    /** Internal path or https URL for a large preview image. */
    image?: string;
    /** Overrides the type's default urgency. */
    urgency?: PushUrgency;
    /** Overrides the type's default time-to-live (0 – 28 days). */
    ttlSeconds?: number;
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
    | 'DELIVERY_FAILED';

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
    error?: { code: NotificationErrorCode; message: string };
}

// ─── Internals ────────────────────────────────────────────────────────────────

/** FCM accepts at most 500 recipients per multicast call. */
const FCM_MULTICAST_LIMIT = 500;

/** FCM data messages are capped at 4096 bytes including its own envelope; stay safely under. */
const MAX_PAYLOAD_BYTES = 3500;

/** FCM error codes that mean "this token will never work again" — safe to delete. */
const DEAD_TOKEN_ERROR_CODES = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
]);

function result(partial: Partial<SendNotificationResult> = {}): SendNotificationResult {
    return { success: true, targeted: 0, sent: 0, failed: 0, removedTokens: 0, ...partial };
}

function failure(code: NotificationErrorCode, message: string, partial: Partial<SendNotificationResult> = {}) {
    return result({ ...partial, success: false, error: { code, message } });
}

function chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
    return chunks;
}

/**
 * firebase-admin initialises (and throws on bad credentials) as soon as it is imported, so it is
 * loaded lazily: a misconfigured environment must not break every route that merely imports
 * this module, only the call that actually tries to send.
 */
async function loadMessaging(): Promise<Messaging> {
    const { adminMessaging } = await import('@/lib/config/firebase-admin');
    return adminMessaging;
}

async function resolveTokens(input: ValidatedNotificationInput): Promise<string[]> {
    if (input.token) return [input.token];
    if (input.tokens) return [...new Set(input.tokens)];

    const userIds = input.userIds ?? (input.userId ? [input.userId] : []);
    return getTokensForUsers([...new Set(userIds)]);
}

function buildPayload(input: ValidatedNotificationInput): NotificationPayload {
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
    if (input.data) {
        payload.data = Object.fromEntries(Object.entries(input.data).map(([key, value]) => [key, String(value)]));
    }
    return payload;
}

interface DeliveryOutcome {
    sent: number;
    failed: number;
    deadTokens: string[];
    errorCodes: Set<string>;
}

/**
 * The only place that talks to FCM. Data-only message: the service worker decides how to display
 * it (see contract.ts). NOTE: token-based multicast is marked deprecated in firebase-admin 14 in
 * favour of Firebase Installation IDs (`fids`); when the app migrates, only this function changes.
 */
async function deliver(
    messaging: Messaging,
    tokens: string[],
    payload: NotificationPayload,
    delivery: { urgency: PushUrgency; ttlSeconds: number }
): Promise<DeliveryOutcome> {
    const outcome: DeliveryOutcome = { sent: 0, failed: 0, deadTokens: [], errorCodes: new Set() };
    const data = { [NOTIFICATION_PAYLOAD_KEY]: JSON.stringify(payload) };
    const webpush = { headers: { TTL: String(delivery.ttlSeconds), Urgency: delivery.urgency } };

    for (const batch of chunk(tokens, FCM_MULTICAST_LIMIT)) {
        try {
            const response = await messaging.sendEachForMulticast({ tokens: batch, data, webpush });

            response.responses.forEach((r, index) => {
                if (r.success) {
                    outcome.sent += 1;
                } else if (r.error && DEAD_TOKEN_ERROR_CODES.has(r.error.code)) {
                    outcome.deadTokens.push(batch[index]);
                } else {
                    outcome.failed += 1;
                    outcome.errorCodes.add(r.error?.code ?? 'unknown');
                }
            });
        } catch (error) {
            // The whole call failed (network, credentials, FCM outage): none of this batch was sent.
            outcome.failed += batch.length;
            outcome.errorCodes.add((error as { code?: string })?.code ?? 'unknown');
        }
    }

    return outcome;
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

    // 2. Build the payload once; every device receives the same one.
    const payload = buildPayload(input);
    const payloadBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    if (payloadBytes > MAX_PAYLOAD_BYTES) {
        const message = `Notification is too large (${payloadBytes} bytes, max ${MAX_PAYLOAD_BYTES}). Shorten the text or data.`;
        console.error(`[notification] ${message}`);
        return failure('INVALID_INPUT', message);
    }

    // 3. Resolve who to send to
    let tokens: string[];
    try {
        tokens = await resolveTokens(input);
    } catch (error) {
        console.error('[notification] Could not load device tokens:', error);
        return failure('TOKEN_LOOKUP_FAILED', 'Could not load the recipients\' devices.');
    }
    if (tokens.length === 0) return result(); // nobody has notifications enabled — not an error

    // 4. Send
    let messaging: Messaging;
    try {
        messaging = await loadMessaging();
    } catch (error) {
        console.error('[notification] Firebase Admin is not configured:', error);
        return failure('NOT_CONFIGURED', 'Firebase Admin could not be initialised.', { targeted: tokens.length });
    }

    const config = NOTIFICATION_TYPE_CONFIG[input.type];
    const outcome = await deliver(messaging, tokens, payload, {
        urgency: input.urgency ?? config.urgency,
        ttlSeconds: input.ttlSeconds ?? config.ttlSeconds,
    });

    // 5. Housekeeping: forget tokens FCM says are dead (best-effort, never fails the send)
    let removedTokens = 0;
    if (outcome.deadTokens.length > 0) {
        try {
            await deleteTokens(outcome.deadTokens);
            removedTokens = outcome.deadTokens.length;
        } catch (error) {
            console.error('[notification] Could not remove dead device tokens:', error);
        }
    }

    const summary = { targeted: tokens.length, sent: outcome.sent, failed: outcome.failed, removedTokens };
    if (outcome.failed > 0) {
        const codes = [...outcome.errorCodes].join(', ');
        console.error(`[notification] ${outcome.failed}/${tokens.length} deliveries failed (${codes})`);
        return failure('DELIVERY_FAILED', `${outcome.failed} of ${tokens.length} deliveries failed (${codes}).`, summary);
    }
    return result(summary);
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
