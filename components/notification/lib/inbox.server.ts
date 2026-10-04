/**
 * SERVER ONLY — uses firebase-admin. Never import this from a client component.
 *
 * The write side of the in-app notification list: documents in the Firestore `Notification`
 * collection, one per recipient and logical notification. The browser only ever READS them
 * (components/notification/hooks/useNotifications.ts); everything that changes them goes through
 * here, behind an authenticated route.
 *
 *   { userId, type, title, body, link?, data?, isRead, createdAt }
 *
 * Document ids are derived from the recipient and the notification's identity (identity.server.ts),
 * so sending the same notification again updates its document rather than adding another. The
 * lifecycle — stored on send, deleted once the user clicks it — is described in contract.ts.
 *
 * Each change also moves the recipient's unread counter (unreadCount.server.ts) in the same
 * transaction, so the list and the count never disagree.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { NOTIFICATION_COLLECTION, type NotificationPayload } from './contract';
import { chunk } from './chunk';
import { firestore } from './firestore.server';
import { notificationDocId } from './identity.server';
import { readUnreadCounters, writeUnreadCounter } from './unreadCount.server';

/** Firestore allows at most 500 writes per commit. */
const MAX_WRITES = 500;

/** Storing a notification is two writes: the notification itself and its recipient's counter. */
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
    const total: SaveToInboxResult = { created: 0, updated: 0 };
    if (userIds.length === 0) return total;

    const collection = await notificationCollection();
    const { type, title, body, link, data } = payload;

    for (const group of chunk(userIds, USERS_PER_COMMIT)) {
        const outcome = await collection.firestore.runTransaction(async (tx) => {
            // Reads must happen before writes inside a transaction. (Counted per attempt: a retry starts over.)
            const existing = await tx.getAll(...group.map((userId) => collection.doc(notificationDocId(userId, key))));
            const counters = await readUnreadCounters(tx, group);
            const attempt: SaveToInboxResult = { created: 0, updated: 0 };

            existing.forEach((snapshot, index) => {
                // The counter counts unread notifications: a new one adds 1, and so does a read one
                // that is unread again; refreshing one that is still unread changes nothing.
                let unreadDelta = 1;

                if (snapshot.exists) {
                    unreadDelta = snapshot.get('isRead') === true ? 1 : 0;
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
                        userId: group[index],
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

                if (unreadDelta !== 0) writeUnreadCounter(tx, counters[index], unreadDelta);
            });
            return attempt;
        });

        total.created += outcome.created;
        total.updated += outcome.updated;
    }
    return total;
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
