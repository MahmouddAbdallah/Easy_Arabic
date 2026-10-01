/**
 * SERVER ONLY — uses firebase-admin. Never import this from a client component.
 *
 * Centralized unread-message counter, one per user:
 *
 *   unreadMessageCount (collection)
 *     └── {userId} (document)  ->  { count: number }
 *
 * `count` is the TOTAL number of unread messages across every chat the user is in, i.e. the sum of
 * chats/{chatId}.unreadCount.<userId> over all of those chats (per-chat shape and tolerant reader:
 * ./unread.ts). It is not the number of chats that have something unread.
 *
 * The counter is never recomputed from scratch on the hot path. Every place that changes a chat's
 * per-user counter (a send, a reaction, mark-read) changes this total by the same amount, inside the
 * SAME Firestore transaction, so the two can't drift apart and a retried transaction can't count twice:
 *
 *   const total = await readUnreadTotal(tx, userId);   // read phase (before any tx.set / tx.update)
 *   ...
 *   writeUnreadTotal(tx, total, +1);                    // write phase
 */
import type { DocumentReference, Transaction } from "firebase-admin/firestore";
import { firebaseAdminDB } from "@/lib/config/firebase-admin";
import { getUnreadCount } from "./unread";

/** unreadMessageCount/{userId} */
export function unreadTotalRef(userId: string): DocumentReference {
    return firebaseAdminDB.collection("unreadMessageCount").doc(userId);
}

/** A user's total as read inside a transaction, ready to be adjusted by writeUnreadTotal(). */
export interface UnreadTotal {
    ref: DocumentReference;
    count: number;
}

/**
 * Read phase. Returns the user's current total.
 *
 * Chats that already had unread messages before this counter existed are not in it yet, so when the
 * counter document is missing it is first built from the user's chats (one query, once per user).
 * That sum is taken from the chats as they are BEFORE this transaction's writes, so the caller's
 * delta can simply be added to it afterwards.
 */
export async function readUnreadTotal(tx: Transaction, userId: string): Promise<UnreadTotal> {
    const ref = unreadTotalRef(userId);
    const snap = await tx.get(ref);

    if (snap.exists) {
        const stored: unknown = snap.get("count");
        return { ref, count: typeof stored === "number" && Number.isFinite(stored) && stored > 0 ? stored : 0 };
    }

    const chats = await tx.get(firebaseAdminDB.collection("chats").where("participants", "array-contains", userId));
    const count = chats.docs.reduce((sum, chat) => sum + getUnreadCount(chat.get("unreadCount"), userId), 0);
    return { ref, count };
}

/**
 * Write phase: stores `total + delta` (+1 for a new unread message, -n when n were just read).
 * Never goes below 0.
 */
export function writeUnreadTotal(tx: Transaction, total: UnreadTotal, delta: number) {
    tx.set(total.ref, { count: Math.max(0, total.count + delta) });
}
