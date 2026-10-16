/**
 * SERVER ONLY (it builds firebase-admin field values). Kept apart from ./groupMessages.server.ts so the rule can be
 * tested without a Firestore connection.
 */
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { isUnreadCountMap } from "./unread";
import type { ChatUpdate } from "./unread.server";

/**
 * "Each of `recipientIds` has one more unread message", as `update()` pairs. With the per-user map only their own
 * keys are touched (FieldValue.increment), so two people sending at the same moment never overwrite each other's
 * numbers. A group is always created with the map; anything else is replaced by a fresh one rather than trusted.
 * `isRead` is false while somebody has something unread, and appears once whatever the number of recipients.
 */
export function groupUnreadUpdates(current: unknown, participants: readonly string[], recipientIds: readonly string[]): ChatUpdate[] {
    if (!isUnreadCountMap(current)) {
        const counts: Record<string, number> = Object.fromEntries(participants.map((id) => [id, 0]));
        for (const id of recipientIds) counts[id] = 1;
        return [["unreadCount", counts], ["isRead", false]];
    }
    return [...recipientIds.map((id): ChatUpdate => [new FieldPath("unreadCount", id), FieldValue.increment(1)]), ["isRead", false]];
}
