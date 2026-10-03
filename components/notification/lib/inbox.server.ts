/**
 * SERVER ONLY — uses firebase-admin. Never import this from a client component.
 *
 * The write side of the in-app notification list: documents in the Firestore `Notification`
 * collection, one per recipient. The browser only ever READS them (components/notification/hooks/
 * useNotifications.ts); everything that changes them goes through here, behind an authenticated route.
 *
 *   { userId, type, title, body, link?, data?, isRead, createdAt }
 *
 * Each change also moves the recipient's unread counter (unreadCount.server.ts) in the same
 * transaction, so the list and the count never disagree.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { NOTIFICATION_COLLECTION, type NotificationPayload } from './contract';
import { chunk } from './chunk';
import { firestore } from './firestore.server';
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

/** Stores one unread notification per user. Throws if the write fails. */
export async function saveToInbox(userIds: string[], payload: NotificationPayload): Promise<number> {
    if (userIds.length === 0) return 0;

    const collection = await notificationCollection();
    const { type, title, body, link, data } = payload;
    const content = { type, title, body, ...(link ? { link } : {}), ...(data ? { data } : {}) };

    for (const group of chunk(userIds, USERS_PER_COMMIT)) {
        await collection.firestore.runTransaction(async (tx) => {
            // Reads must happen before writes inside a transaction.
            const counters = await readUnreadCounters(tx, group);

            group.forEach((userId) => {
                tx.create(collection.doc(), {
                    ...content,
                    userId,
                    isRead: false,
                    createdAt: FieldValue.serverTimestamp(),
                });
            });
            counters.forEach((counter) => writeUnreadCounter(tx, counter, 1));
        });
    }
    return userIds.length;
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
