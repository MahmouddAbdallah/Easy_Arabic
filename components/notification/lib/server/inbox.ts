/**
 * SERVER ONLY — uses firebase-admin (through ./firestore).
 *
 * The write side of the in-app notification list: documents in the Firestore `Notification`
 * collection, one per recipient and logical notification. The browser only ever READS them
 * (components/notification/hooks/useNotifications.ts); everything that changes them goes through
 * here, behind an authenticated route.
 *
 *   { userId, type, title, body, link?, data?, isRead, createdAt }
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
import { firestore } from './firestore';
import { notificationDocId } from './identity';
import { readUnreadCounters, writeUnreadCounter } from './unreadCounter';

/** Firestore allows at most 500 writes per commit. */
const MAX_WRITES = 500;

/** Storing a notification is at most two writes: the notification itself and its recipient's counter. */
const USERS_PER_COMMIT = MAX_WRITES / 2;

/** Marking notifications read is one write each, plus one for the counter. */
const MARK_READ_PER_COMMIT = MAX_WRITES - 1;

async function notificationCollection() {
    return (await firestore()).collection(NOTIFICATION_COLLECTION);
}

export interface SaveToInboxResult {
    /** Users who got a new document. */
    created: number;
    /** Users whose existing document for the same notification was updated instead. */
    updated: number;
}

/**
 * Stores the notification `key` for each user: a first send creates the document, a repeat updates it
 * in place — new content, `createdAt` refreshed so it moves back to the top of the list, unread again.
 * Fields the new content no longer has (`link`, `data`) are removed. Throws if the write fails.
 */
export async function saveToInbox(userIds: string[], key: string, payload: NotificationPayload): Promise<SaveToInboxResult> {
    const users = [...new Set(userIds)];
    if (users.length === 0) return { created: 0, updated: 0 };

    const collection = await notificationCollection();

    // Each commit has its own users, so the commits do not wait for each other (at most 4 for 1000 users).
    const outcomes = await Promise.all(chunk(users, USERS_PER_COMMIT).map((group) => saveGroup(collection, group, key, payload)));

    return outcomes.reduce((total, outcome) => ({
        created: total.created + outcome.created,
        updated: total.updated + outcome.updated,
    }));
}

/** One transaction for up to USERS_PER_COMMIT users (`group` has no duplicates). */
function saveGroup(collection: CollectionReference, group: string[], key: string, payload: NotificationPayload): Promise<SaveToInboxResult> {
    const { type, title, body, link, data } = payload;

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

        const attempt: SaveToInboxResult = { created: 0, updated: 0 };

        existing.forEach((snapshot, index) => {
            const userId = group[index];

            if (snapshot.exists) {
                tx.update(snapshot.ref, {
                    type,
                    title,
                    body,
                    link: link ?? FieldValue.delete(),
                    data: data ?? FieldValue.delete(),
                    isRead: false,
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

        unread.forEach((s) => tx.update(s.ref, { isRead: true }));
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

            unread.docs.forEach((doc) => tx.update(doc.ref, { isRead: true }));
            writeUnreadCounter(tx, counter, -unread.size);
            return unread.size;
        });

        updated += marked;
        if (marked < MARK_READ_PER_COMMIT) return updated;
    }
}
