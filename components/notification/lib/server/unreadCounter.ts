/**
 * SERVER ONLY — uses firebase-admin (through ./firestore).
 *
 * The unread-notification counter, one document per user (shape: UNREAD_COUNT_COLLECTION in
 * contract.ts). It is never recomputed on the hot path. Every place that flips a notification
 * between unread and read (a new one is stored, mark-as-read, a click that deletes it) changes the
 * counter by the same amount inside the SAME Firestore transaction, so the two can't drift apart and
 * a retried transaction can't count twice — the same rule as the chat's unread-message total.
 *
 *   const counters = await readUnreadCounters(tx, userIds);   // read phase (before any tx.set / tx.update)
 *   ...
 *   writeUnreadCounter(tx, counters[0], -3);                   // write phase
 *
 * The counter is read only by transactions that actually change it: a notification that is merely
 * refreshed while still unread leaves it alone, so it is not even read (see inbox.ts). A notification
 * that is suppressed (see presence.ts) is never stored, so it never reaches the counter.
 */
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
import { NOTIFICATION_COLLECTION, UNREAD_COUNT_COLLECTION } from '../contract';
import { firestore } from './firestore';

/** A user's counter as read inside a transaction, ready to be adjusted by writeUnreadCounter(). */
export interface UnreadCounter {
    ref: DocumentReference;
    count: number;
}

/**
 * Read phase. Returns the current counter of each user, in the order given (`userIds` must not be empty).
 *
 * Users whose counter document is missing (notifications stored before the counter existed, or none
 * yet) get theirs counted from their unread notifications — one aggregate query, once per user. That
 * count is taken BEFORE this transaction's writes, so the caller's delta can simply be added to it.
 */
export async function readUnreadCounters(tx: Transaction, userIds: string[]): Promise<UnreadCounter[]> {
    const db = await firestore();
    const refs = userIds.map((userId) => db.collection(UNREAD_COUNT_COLLECTION).doc(userId));

    return Promise.all(
        (await tx.getAll(...refs)).map(async (snapshot) => {
            if (snapshot.exists) {
                const stored: unknown = snapshot.get('count');
                return { ref: snapshot.ref, count: typeof stored === 'number' && Number.isFinite(stored) && stored > 0 ? stored : 0 };
            }

            const unread = db.collection(NOTIFICATION_COLLECTION).where('userId', '==', snapshot.id).where('isRead', '==', false);
            return { ref: snapshot.ref, count: (await tx.get(unread.count())).data().count };
        })
    );
}

/** Write phase: stores `count + delta` (+1 for a new unread notification, -n when n were just read). Never below 0. */
export function writeUnreadCounter(tx: Transaction, counter: UnreadCounter, delta: number) {
    tx.set(counter.ref, { count: Math.max(0, counter.count + delta) });
}
