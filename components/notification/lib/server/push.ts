/**
 * SERVER ONLY — talks to FCM. The `server-only` import fails the build if a client component ever
 * reaches this module.
 *
 * The transport: turns ready NotificationPayloads into FCM messages, sends them to device tokens and
 * forgets the tokens FCM says are dead. It knows nothing about users, the in-app list or suppression —
 * that is sendNotification.ts. NOTE: token-based sending is marked deprecated in firebase-admin 14 in
 * favour of Firebase Installation IDs (`fids`); when the app migrates, only this file changes.
 *
 * How a send is shaped (from reading what firebase-admin 14 does underneath):
 *   - `sendEach` opens ONE HTTP/2 connection per call and fires every message of the call at once. So all the
 *     messages of a send — the loud and the silent audience together — travel in the same calls (500 messages per
 *     call, the SDK's maximum) instead of one call per audience: a send to a few hundred devices is one connection
 *     where it used to be two. Calls run side by side up to FCM_BATCH_CONCURRENCY, which is high enough for the
 *     largest send the schema accepts (5,000 raw tokens) to go out at once; the limit exists for what lies beyond that.
 *   - A message that failed for a reason that passes (FCM or the network hiccuping) is sent again — only that
 *     message, a couple of times, with a growing, jittered pause. A dead token is never retried, it is forgotten; any
 *     other failure is final. A repeated delivery is harmless: the service worker and the page both recognise the same
 *     send id and show it once.
 */
import 'server-only';
import type { Messaging, TokenMessage } from 'firebase-admin/messaging';
import { NOTIFICATION_PAYLOAD_KEY, type NotificationPayload, type PushUrgency } from '../contract';
import { chunk } from './chunk';
import { backoffMs, settleWithLimit, sleep } from './concurrency';
import { deleteTokens } from './devices';

/** FCM accepts at most 500 messages per `sendEach` call. */
const FCM_BATCH_SIZE = 500;

/**
 * `sendEach` calls in flight at once (each is its own connection to FCM). Ten calls are 5,000 messages — the most a
 * single send can address — so no allowed send queues behind another of its own calls. A lower limit would only make
 * big sends slower: six calls (3,000 messages) through three slots go out in two rounds, so the last devices wait twice
 * as long, and nothing today needs protecting from ten connections.
 */
const FCM_BATCH_CONCURRENCY = 10;

/** First send plus two retries. The pauses (about 0.25–0.5 s, then 0.5–1 s) keep the worst case under two seconds. */
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 500;
const RETRY_MAX_MS = 2_000;

/** FCM error codes that mean "this token will never work again" — safe to delete. */
const DEAD_TOKEN_ERROR_CODES = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
]);

/**
 * Failures that say nothing about the message or the device, only about the moment: FCM answered with an internal
 * error, was unavailable or throttled us, or the connection broke. (`sendEach` reports a broken HTTP/2 session —
 * a reset, a GOAWAY — as `messaging/unknown-error`.) The SDK already retries a plain 503 by itself.
 */
const TRANSIENT_ERROR_CODES = new Set([
    'messaging/internal-error',
    'messaging/server-unavailable',
    'messaging/message-rate-exceeded',
    'messaging/unknown-error',
    'app/network-error',
    'app/network-timeout',
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
    /** Devices that failed for a reason other than a dead token (e.g. FCM outage), after the retries. */
    failed: number;
    /** Dead tokens FCM reported and that were deleted from the database. */
    removedTokens: number;
    /** The FCM error codes behind `failed`, for logs and error messages. */
    errorCodes: string[];
}

/** Some devices and what to show them — e.g. the audible audience and, with `silent: true`, the quiet one. */
export interface PushTarget {
    tokens: string[];
    payload: NotificationPayload;
}

interface BatchOutcome {
    sent: number;
    failed: number;
    deadTokens: string[];
    errorCodes: string[];
}

type Attempt = { ok: true } | { ok: false; code: string };

/** One `sendEach` call: one verdict per message, in order. Never throws — a failed call is a failed verdict for every message. */
async function attemptOnce(messaging: Messaging, messages: TokenMessage[]): Promise<Attempt[]> {
    try {
        const response = await messaging.sendEach(messages);
        return response.responses.map((r): Attempt => (r.success ? { ok: true } : { ok: false, code: r.error?.code ?? 'unknown' }));
    } catch (error) {
        // The whole call failed (network, credentials, FCM outage): none of these messages was sent.
        const code = (error as { code?: string } | null)?.code ?? 'unknown';
        return messages.map((): Attempt => ({ ok: false, code }));
    }
}

/** At most FCM_BATCH_SIZE messages, retried as described above. Never throws. */
async function sendBatch(messaging: Messaging, messages: TokenMessage[]): Promise<BatchOutcome> {
    const outcome: BatchOutcome = { sent: 0, failed: 0, deadTokens: [], errorCodes: [] };
    let pending = messages;

    for (let attempt = 1; pending.length > 0; attempt++) {
        const verdicts = await attemptOnce(messaging, pending);

        const again: TokenMessage[] = [];
        verdicts.forEach((verdict, index) => {
            if (verdict.ok) {
                outcome.sent += 1;
            } else if (DEAD_TOKEN_ERROR_CODES.has(verdict.code)) {
                outcome.deadTokens.push(pending[index].token);
            } else if (TRANSIENT_ERROR_CODES.has(verdict.code) && attempt < MAX_ATTEMPTS) {
                again.push(pending[index]);
            } else {
                outcome.failed += 1;
                outcome.errorCodes.push(verdict.code);
            }
        });

        pending = again;
        if (pending.length > 0) await sleep(backoffMs(attempt, RETRY_BASE_MS, RETRY_MAX_MS));
    }

    return outcome;
}

/**
 * Sends every target's payload to its tokens and deletes the dead tokens. Data-only message: the service worker
 * decides how to display it (see contract.ts). Never throws — failures are counted in the outcome.
 */
export async function pushToDevices(
    messaging: Messaging,
    targets: PushTarget[],
    delivery: { urgency: PushUrgency; ttlSeconds: number }
): Promise<PushOutcome> {
    const webpush = { headers: { TTL: String(delivery.ttlSeconds), Urgency: delivery.urgency } };

    const messages: TokenMessage[] = targets.flatMap(({ tokens, payload }) => {
        const data = { [NOTIFICATION_PAYLOAD_KEY]: JSON.stringify(payload) }; // serialised once per audience, not once per device
        return tokens.map((token): TokenMessage => ({ token, data, webpush }));
    });

    const groups = chunk(messages, FCM_BATCH_SIZE);
    const settled = await settleWithLimit(groups, FCM_BATCH_CONCURRENCY, (batch) => sendBatch(messaging, batch));
    // sendBatch never rejects; should it ever (a bug), the messages of that batch are reported as failed, not forgotten.
    const batches = settled.map(
        (result, index): BatchOutcome =>
            result.status === 'fulfilled' ? result.value : { sent: 0, failed: groups[index].length, deadTokens: [], errorCodes: ['unknown'] }
    );

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
