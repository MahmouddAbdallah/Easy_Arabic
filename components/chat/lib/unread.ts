/**
 * chats/{chatId}.unreadCount holds one counter PER USER:
 *
 *   unreadCount: { [userId]: number }        e.g. { A: 0, B: 3 }  ->  B has 3 unread things
 *
 * The first version stored a single number shared by both users. Those documents still exist until the
 * next message/reaction in that chat converts them, so every reader has to accept both shapes.
 *
 * Pure helpers: safe to import from both client and server code (write side: ./unread.server.ts).
 */
export type UnreadCount = Record<string, number> | number;

/** True for the per-user shape (a plain object); false for the legacy number, null, undefined... */
export function isUnreadCountMap(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The unread count of one user: `unreadCount?.[userId] ?? 0`, except that it also accepts the legacy
 * numeric value. A legacy number reads as 0: it was a single counter for both users and was never
 * reset, so it says nothing about what this particular user has left unread.
 */
export function getUnreadCount(unreadCount: unknown, userId: string | null | undefined): number {
    if (!userId || !isUnreadCountMap(unreadCount)) return 0;
    const value = unreadCount[userId];
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}
