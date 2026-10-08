/**
 * SERVER ONLY — uses firebase-admin (through ./firestore).
 *
 * The write side of the in-app notification list: documents in the Firestore `Notification`
 * collection, one per recipient and logical notification. The browser only ever READS them
 * (components/notification/hooks/useNotifications.ts); everything that changes them goes through
 * here, behind an authenticated route.
 *
 *   { userId, type, title, body, link?, data?, isRead, createdAt, key, sendId, count, expireAt? }
 *
 *   key      the notification's identity (identity.ts) — what a click reports so the copy can be cleared
 *   sendId   id of the latest send — lets an open page recognise a push it already showed (no double alert)
 *   count    how many sends this unread notification stands for ("3 new messages"); restarts at 1 once read
 *   expireAt set when the notification is marked read, cleared if it becomes unread again: point a Firestore
 *            TTL policy at it to prune old READ notifications — unread ones never expire, so the unread
 *            counter cannot drift
 *
 * Document ids are derived from the recipient and the notification's identity (identity.ts), so
 * sending the same notification again updates its document rather than adding another. The
 * lifecycle — stored on send, deleted once the user clicks it — is described in contract.ts.
 *
 * Each change that flips unread state also moves the recipient's unread counter (unreadCounter.ts) in
 * the same transaction, so the list and the count never disagree. A change that does not flip it
 * (refreshing a notification that is still unread) is a transaction on the notification alone.
 */
import { FieldValue, type CollectionReference } from 'firebase-admin/firestore';
import { NOTIFICATION_COLLECTION, type NotificationPayload } from '../contract';
import { chunk } from './chunk';
import { settleWithLimit } from './concurrency';
import { firestore } from './firestore';
import { notificationDocId } from './identity';
import { readUnreadCounters, writeUnreadCounter } from './unreadCounter';

/** Firestore allows at most 500 writes per commit. */
const MAX_WRITES = 500;

/**
 * Users stored per transaction. Storing a notification is at most two writes per user (the notification and its
 * recipient's counter), so the ceiling is MAX_WRITES / 2 = 250. We stay well under it on purpose: a server-side
 * transaction holds locks on everything it reads and writes until it commits, and a conflict on ONE of those
 * documents makes the WHOLE transaction wait, abort and start over. A smaller group is a shorter commit, so the
 * locks other notifications (a chat message to one of these users) wait for are held for less time, and a retry
 * redoes less. The cost is a few more round trips, which — see COMMIT_CONCURRENCY — run side by side.
 */
const USERS_PER_COMMIT = 100;

/**
 * Transactions in flight at once for one send. The biggest audience sendNotification accepts (1000 users) is ten
 * groups, so every group of it goes out together; the limit only matters if that ceiling is ever raised, and then it
 * keeps one send from flooding the instance. Do not lower it without thought: with fewer slots than groups the
 * groups queue in waves and a large send takes noticeably longer than it would with a few big transactions.
 */
const COMMIT_CONCURRENCY = 10;

/** Marking notifications read is one write each, plus one for the counter. */
const MARK_READ_PER_COMMIT = MAX_WRITES - 1;

/** How long a notification that was read stays in the list before a TTL policy on `expireAt` may remove it. */
export const READ_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const readUpdate = () => ({ isRead: true, expireAt: new Date(Date.now() + READ_RETENTION_MS) });

async function notificationCollection() {
    return (await firestore()).collection(NOTIFICATION_COLLECTION);
}

export interface SaveToInboxResult {
    /** Users who got a new document. */
    created: number;
    /** Users whose existing document for the same notification was updated instead. */
    updated: number;
    /** Users whose copy could NOT be stored because their transaction failed; everybody else was stored. */
    failed: string[];
}

/**
 * Stores the notification `key` for each user: a first send creates the document, a repeat updates it
 * in place — new content, `createdAt` refreshed so it moves back to the top of the list, unread again.
 * Fields the new content no longer has (`link`, `data`) are removed.
 *
 * A big audience is split into groups that commit independently (COMMIT_CONCURRENCY at a time), and a group that
 * fails does not undo or hide the others: the result says exactly who was stored and who was not (`failed`), so the
 * caller reports the truth instead of "nothing was saved" while most people were. Users are taken in a fixed (sorted)
 * order, so two overlapping broadcasts ask for the same documents in the same order — the usual recipe against
 * locking each other out in opposite directions. Throws only if Firestore cannot be reached at all.
 */
export async function saveToInbox(userIds: string[], key: string, payload: NotificationPayload): Promise<SaveToInboxResult> {
    const users = [...new Set(userIds)].sort();
    const total: SaveToInboxResult = { created: 0, updated: 0, failed: [] };
    if (users.length === 0) return total;

    const collection = await notificationCollection();
    const groups = chunk(users, USERS_PER_COMMIT);

    const outcomes = await settleWithLimit(groups, COMMIT_CONCURRENCY, (group) => saveGroup(collection, group, key, payload));

    let firstError: unknown;
    outcomes.forEach((outcome, index) => {
        if (outcome.status === 'fulfilled') {
            total.created += outcome.value.created;
            total.updated += outcome.value.updated;
        } else {
            firstError ??= outcome.reason;
            total.failed.push(...groups[index]);
        }
    });
    if (total.failed.length > 0) {
        console.error(`[notification] Could not store the in-app copy for ${total.failed.length} of ${users.length} users:`, firstError);
    }
    return total;
}

/** One transaction for up to USERS_PER_COMMIT users (`group` has no duplicates). */
function saveGroup(collection: CollectionReference, group: string[], key: string, payload: NotificationPayload): Promise<Pick<SaveToInboxResult, 'created' | 'updated'>> {
    const { type, title, body, link, data } = payload;
    const identity = { key, sendId: payload.id };

    return collection.firestore.runTransaction(async (tx) => {
        // Reads must happen before writes inside a transaction. (Counted per attempt: a retry starts over.)
        const existing = await tx.getAll(...group.map((userId) => collection.doc(notificationDocId(userId, key))));

        // The counter counts unread notifications: a new one adds 1, and so does a read one that is unread
        // again. Refreshing one that is still unread changes nothing — the common case of a conversation
        // sending message after message — and then the counter is not read, locked or written at all.
        const becomesUnread = existing.map((snapshot) => !snapshot.exists || snapshot.get('isRead') === true);
        const bumped = group.filter((_, index) => becomesUnread[index]);
        const counters = bumped.length > 0 ? await readUnreadCounters(tx, bumped) : [];
        const counterOf = new Map(bumped.map((userId, index) => [userId, counters[index]]));

        const attempt = { created: 0, updated: 0 };

        existing.forEach((snapshot, index) => {
            const userId = group[index];

            if (snapshot.exists) {
                // Still unread: one more send of the same notification. Read (or unknown): it starts over at 1.
                const previous = snapshot.get('count');
                const count = snapshot.get('isRead') === true ? 1 : (typeof previous === 'number' && previous >= 1 ? previous : 1) + 1;

                tx.update(snapshot.ref, {
                    type,
                    title,
                    body,
                    link: link ?? FieldValue.delete(),
                    data: data ?? FieldValue.delete(),
                    ...identity,
                    count,
                    isRead: false,
                    expireAt: FieldValue.delete(),
                    createdAt: FieldValue.serverTimestamp(),
                });
                attempt.updated += 1;
            } else {
                tx.create(snapshot.ref, {
                    userId,
                    type,
                    title,
                    body,
                    ...(link ? { link } : {}),
                    ...(data ? { data } : {}),
                    ...identity,
                    count: 1,
                    isRead: false,
                    createdAt: FieldValue.serverTimestamp(),
                });
                attempt.created += 1;
            }

            const counter = counterOf.get(userId);
            if (counter) writeUnreadCounter(tx, counter, 1);
        });
        return attempt;
    });
}

/**
 * The user clicked the delivered notification `key`: it was handled, so its stored copy is deleted.
 * Returns whether there was one. A copy that was still unread also leaves the unread counter. Only the
 * caller's own document can match — its id is derived from `userId`.
 */
export async function resolveNotification(userId: string, key: string): Promise<boolean> {
    const collection = await notificationCollection();
    const ref = collection.doc(notificationDocId(userId, key));

    return collection.firestore.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists) return false;

        // Reads must happen before writes.
        const wasUnread = snapshot.get('isRead') !== true;
        const counter = wasUnread ? (await readUnreadCounters(tx, [userId]))[0] : undefined;

        tx.delete(ref);
        if (counter) writeUnreadCounter(tx, counter, -1);
        return true;
    });
}

/**
 * Marks the given notifications as read — but only ones that belong to `userId`; ids that don't
 * exist, belong to someone else or are already read are skipped. Returns how many were updated.
 * (At most MAX_MARK_READ_IDS ids per call, enforced by the route's schema.)
 */
export async function markAsRead(userId: string, ids: string[]): Promise<number> {
    const collection = await notificationCollection();

    return collection.firestore.runTransaction(async (tx) => {
        // A repeated id must not be counted twice. Reads must happen before writes.
        const snapshots = await tx.getAll(...[...new Set(ids)].map((id) => collection.doc(id)));
        const unread = snapshots.filter((s) => s.exists && s.get('userId') === userId && s.get('isRead') !== true);
        if (unread.length === 0) return 0;

        const [counter] = await readUnreadCounters(tx, [userId]);

        unread.forEach((s) => tx.update(s.ref, readUpdate()));
        writeUnreadCounter(tx, counter, -unread.length);
        return unread.length;
    });
}

/** Marks every unread notification of `userId` as read, however many there are. */
export async function markAllAsRead(userId: string): Promise<number> {
    const collection = await notificationCollection();
    const unreadQuery = collection.where('userId', '==', userId).where('isRead', '==', false).limit(MARK_READ_PER_COMMIT);
    let updated = 0;

    for (;;) {
        const marked = await collection.firestore.runTransaction(async (tx) => {
            const unread = await tx.get(unreadQuery);
            if (unread.empty) return 0;

            const [counter] = await readUnreadCounters(tx, [userId]);

            unread.docs.forEach((doc) => tx.update(doc.ref, readUpdate()));
            writeUnreadCounter(tx, counter, -unread.size);
            return unread.size;
        });

        updated += marked;
        if (marked < MARK_READ_PER_COMMIT) return updated;
    }
}
