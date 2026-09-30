/**
 * SERVER ONLY — uses firebase-admin. Never import this from a client component.
 *
 * Write side of chats/{chatId}.unreadCount (shape and tolerant reader: ./unread.ts).
 * Each helper returns `update()` field/value pairs that the caller applies inside a Firestore
 * transaction, together with its own fields, on a chat document that already exists.
 */
import { FieldPath, FieldValue, type DocumentReference, type Transaction } from "firebase-admin/firestore";
import { getUnreadCount, isUnreadCountMap } from "./unread";

/** One `update()` entry. Pairs rather than an object, because only pairs accept FieldPath keys. */
export type ChatUpdate = [field: string | FieldPath, value: unknown];

/** `tx.update(chatRef, ...)` for a list of field/value pairs. */
export function updateChat(tx: Transaction, chatRef: DocumentReference, updates: ChatUpdate[]) {
    if (updates.length === 0) return;
    const [[field, value], ...rest] = updates;
    tx.update(chatRef, field, value, ...rest.flat());
}

/** A fresh per-user map for a chat's first unread event: 1 for the recipient, 0 for everybody else. */
export function newUnreadCounts(participants: string[], recipientId: string): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const id of participants) counts[id] = 0;
    counts[recipientId] = 1;
    return counts;
}

/**
 * Updates for "`recipientId` has one more unread event" (a new message, or a reaction to their message).
 *
 * - Per-user shape: only `unreadCount.<recipientId>` is touched, with FieldValue.increment. Two users
 *   writing at the same moment can therefore never overwrite each other's numbers.
 * - Legacy shape (one shared number) or missing: the whole field is replaced with a fresh per-user map.
 *   Nested field paths are deliberately not used here, since how Firestore treats a nested path under
 *   a non-map value is not something to depend on.
 *
 * `isRead` is kept in step: it is false while somebody has something unread.
 */
export function unreadIncrementUpdates(current: unknown, participants: string[], recipientId: string): ChatUpdate[] {
    const counter: ChatUpdate = isUnreadCountMap(current)
        ? [new FieldPath("unreadCount", recipientId), FieldValue.increment(1)]
        : ["unreadCount", newUnreadCounts(participants, recipientId)];
    return [counter, ["isRead", false]];
}

/**
 * Updates for "`userId` has read the chat", or null when there is nothing to clear (already 0, which
 * is also what a legacy numeric counter reads as). Only that user's counter is written.
 * `isRead` becomes true once nobody has anything unread.
 */
export function markReadUpdates(current: unknown, participants: string[], userId: string): ChatUpdate[] | null {
    if (getUnreadCount(current, userId) === 0) return null;
    const nobodyLeftUnread = participants.every((id) => id === userId || getUnreadCount(current, id) === 0);
    return [[new FieldPath("unreadCount", userId), 0], ["isRead", nobodyLeftUnread]];
}
