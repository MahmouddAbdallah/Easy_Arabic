/**
 * SERVER ONLY — talks to FCM. The `server-only` import fails the build if a client component ever
 * reaches this module.
 *
 * The transport: turns a ready NotificationPayload into FCM messages, sends them to device tokens and
 * forgets the tokens FCM says are dead. It knows nothing about users, the in-app list or suppression —
 * that is sendNotification.ts. NOTE: token-based multicast is marked deprecated in firebase-admin 14 in
 * favour of Firebase Installation IDs (`fids`); when the app migrates, only this file changes.
 */
import 'server-only';
import type { Messaging } from 'firebase-admin/messaging';
import { NOTIFICATION_PAYLOAD_KEY, type NotificationPayload, type PushUrgency } from '../contract';
import { chunk } from './chunk';
import { deleteTokens } from './devices';

/** FCM accepts at most 500 recipients per multicast call. */
const FCM_MULTICAST_LIMIT = 500;

/** FCM error codes that mean "this token will never work again" — safe to delete. */
const DEAD_TOKEN_ERROR_CODES = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
]);

/**
 * firebase-admin initialises (and throws on bad credentials) as soon as it is imported, so it is
 * loaded lazily: a misconfigured environment must not break every route that merely imports
 * this module, only the call that actually tries to send.
 */
export async function loadMessaging(): Promise<Messaging> {
    const { adminMessaging } = await import('@/lib/config/firebase-admin');
    return adminMessaging;
}

export interface PushOutcome {
    /** Devices FCM accepted the message for. */
    sent: number;
    /** Devices that failed for a reason other than a dead token (e.g. FCM outage). */
    failed: number;
    /** Dead tokens FCM reported and that were deleted from the database. */
    removedTokens: number;
    /** The FCM error codes behind `failed`, for logs and error messages. */
    errorCodes: string[];
}

interface BatchOutcome {
    sent: number;
    failed: number;
    deadTokens: string[];
    errorCodes: string[];
}

/** One multicast call (at most FCM_MULTICAST_LIMIT tokens). Never throws. */
async function sendBatch(
    messaging: Messaging,
    tokens: string[],
    data: Record<string, string>,
    webpush: { headers: Record<string, string> }
): Promise<BatchOutcome> {
    const outcome: BatchOutcome = { sent: 0, failed: 0, deadTokens: [], errorCodes: [] };

    try {
        const response = await messaging.sendEachForMulticast({ tokens, data, webpush });

        response.responses.forEach((r, index) => {
            if (r.success) {
                outcome.sent += 1;
            } else if (r.error && DEAD_TOKEN_ERROR_CODES.has(r.error.code)) {
                outcome.deadTokens.push(tokens[index]);
            } else {
                outcome.failed += 1;
                outcome.errorCodes.push(r.error?.code ?? 'unknown');
            }
        });
    } catch (error) {
        // The whole call failed (network, credentials, FCM outage): none of this batch was sent.
        outcome.failed += tokens.length;
        outcome.errorCodes.push((error as { code?: string })?.code ?? 'unknown');
    }

    return outcome;
}

/**
 * Sends `payload` to every token and deletes the dead ones. Data-only message: the service worker decides
 * how to display it (see contract.ts). Batches go out side by side; a failing batch never affects another.
 * Never throws — failures are counted in the outcome.
 */
export async function pushToDevices(
    messaging: Messaging,
    tokens: string[],
    payload: NotificationPayload,
    delivery: { urgency: PushUrgency; ttlSeconds: number }
): Promise<PushOutcome> {
    const data = { [NOTIFICATION_PAYLOAD_KEY]: JSON.stringify(payload) };
    const webpush = { headers: { TTL: String(delivery.ttlSeconds), Urgency: delivery.urgency } };

    const batches = await Promise.all(chunk(tokens, FCM_MULTICAST_LIMIT).map((batch) => sendBatch(messaging, batch, data, webpush)));

    const deadTokens = batches.flatMap((batch) => batch.deadTokens);
    let removedTokens = 0;

    // Housekeeping: best-effort, never fails the send.
    if (deadTokens.length > 0) {
        try {
            await deleteTokens(deadTokens);
            removedTokens = deadTokens.length;
        } catch (error) {
            console.error('[notification] Could not remove dead device tokens:', error);
        }
    }

    return {
        sent: batches.reduce((total, batch) => total + batch.sent, 0),
        failed: batches.reduce((total, batch) => total + batch.failed, 0),
        removedTokens,
        errorCodes: [...new Set(batches.flatMap((batch) => batch.errorCodes))],
    };
}
