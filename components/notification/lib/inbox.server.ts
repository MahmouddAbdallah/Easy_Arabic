/**
 * SERVER ONLY — uses firebase-admin. Never import this from a client component.
 *
 * The write side of the in-app notification list: documents in the Firestore `Notification`
 * collection, one per recipient. The browser only ever READS them (components/notification/hooks/
 * useNotifications.ts); everything that changes them goes through here, behind an authenticated route.
 *
 *   { userId, type, title, body, link?, data?, isRead, createdAt }
 */
import { FieldValue, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import { NOTIFICATION_COLLECTION, type NotificationPayload } from './contract';
import { chunk } from './chunk';

/** Firestore allows at most 500 writes per batch. */
const BATCH_LIMIT = 500;

/**
 * firebase-admin initialises (and throws on bad credentials) as soon as it is imported, so it is
 * loaded lazily — see sendNotification.ts.
 */
async function notificationCollection() {
    const { firebaseAdminDB } = await import('@/lib/config/firebase-admin');
    return firebaseAdminDB.collection(NOTIFICATION_COLLECTION);
}

async function commitReadUpdates(db: Firestore, refs: DocumentReference[]): Promise<void> {
    const batch = db.batch();
    refs.forEach((ref) => batch.update(ref, { isRead: true }));
    await batch.commit();
}

/** Stores one unread notification per user. Throws if the write fails. */
export async function saveToInbox(userIds: string[], payload: NotificationPayload): Promise<number> {
    if (userIds.length === 0) return 0;

    const collection = await notificationCollection();
    const { type, title, body, link, data } = payload;
    const content = { type, title, body, ...(link ? { link } : {}), ...(data ? { data } : {}) };

    for (const group of chunk(userIds, BATCH_LIMIT)) {
        const batch = collection.firestore.batch();
        for (const userId of group) {
            batch.create(collection.doc(), {
                ...content,
                userId,
                isRead: false,
                createdAt: FieldValue.serverTimestamp(),
            });
        }
        await batch.commit();
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
    const snapshots = await collection.firestore.getAll(...ids.map((id) => collection.doc(id)));

    const unread = snapshots.filter((s) => s.exists && s.get('userId') === userId && s.get('isRead') !== true);
    if (unread.length > 0) await commitReadUpdates(collection.firestore, unread.map((s) => s.ref));
    return unread.length;
}

/** Marks every unread notification of `userId` as read, however many there are. */
export async function markAllAsRead(userId: string): Promise<number> {
    const collection = await notificationCollection();
    let updated = 0;

    for (;;) {
        const unread = await collection.where('userId', '==', userId).where('isRead', '==', false).limit(BATCH_LIMIT).get();
        if (unread.empty) return updated;

        await commitReadUpdates(collection.firestore, unread.docs.map((doc) => doc.ref));
        updated += unread.size;
        if (unread.size < BATCH_LIMIT) return updated;
    }
}
