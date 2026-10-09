/**
 * Per-user state of a conversation. It lives on the chat document itself (chats/{chatId}), next to the
 * data both people share, because that document is already what both browsers listen to:
 *
 *   blocks:    { [blockerId]: ISO time }   who blocked the other participant, and when
 *   clearedAt: { [userId]:    ISO time }   "clear chat": messages sent at or before this time are hidden for that user
 *   deletedAt: { [userId]:    ISO time }   "delete chat": the chat is out of that user's list until something newer arrives
 *
 * Every entry belongs to ONE user, so one person clearing, deleting or blocking never touches what the
 * other person sees. The times are the same ISO strings messages are ordered by (`time`), so "is this
 * message hidden?" is a plain string comparison, the same one Firestore runs for `where("time", ">", ...)`.
 *
 * Pure helpers: safe to import from both client and server code (the writes are in
 * ./conversationOperations.server.ts).
 */

/** The only time format ever written (`Date.prototype.toISOString`). Strict on purpose: it sorts like time does. */
export const ISO_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function isIsoTime(value: unknown): value is string {
    return typeof value === "string" && ISO_TIME_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

/** `{ [userId]: ISO time }` as stored. Anything that isn't a time is ignored (the document is never trusted blindly). */
export function readUserTimes(value: unknown): Record<string, string> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};

    const times: Record<string, string> = {};
    for (const [userId, time] of Object.entries(value)) {
        if (typeof time === "string" && time.length > 0) times[userId] = time;
    }
    return times;
}

/** One user's entry of a `{ [userId]: time }` map, or null. */
export function getUserTime(value: unknown, userId: string | null | undefined): string | null {
    if (!userId) return null;
    return readUserTimes(value)[userId] ?? null;
}

/** The later of two ISO times; null counts as "nothing". */
export function laterOf(a: string | null | undefined, b: string | null | undefined): string | null {
    if (!a) return b ?? null;
    if (!b) return a;
    return a >= b ? a : b;
}

/** The earlier of two ISO times; null counts as "nothing". */
export function earlierOf(a: string | null | undefined, b: string | null | undefined): string | null {
    if (!a) return b ?? null;
    if (!b) return a;
    return a <= b ? a : b;
}

/* -------------------------------------------------------------------------------------------------
 * Blocking
 * ---------------------------------------------------------------------------------------------- */

export interface BlockStatus {
    /** The current user blocked the other person. */
    byMe: boolean;
    /** The other person blocked the current user. */
    byOther: boolean;
    /** Either of the two: nothing can be sent, reacted to or called in either direction. */
    any: boolean;
}

export function getBlockStatus(blocks: unknown, me: string | null | undefined, other: string | null | undefined): BlockStatus {
    const byMe = getUserTime(blocks, me) !== null;
    const byOther = getUserTime(blocks, other) !== null;
    return { byMe, byOther, any: byMe || byOther };
}

/* -------------------------------------------------------------------------------------------------
 * Clearing and deleting
 * ---------------------------------------------------------------------------------------------- */

interface ChatTimes {
    /** ISO time of the latest message (or call entry) of the chat. */
    time?: unknown;
    clearedAt?: unknown;
    deletedAt?: unknown;
}

/** Is the message sent at `time` hidden for a user who cleared the chat at `clearedAt`? */
export function isHiddenByClear(time: string, clearedAt: string | null): boolean {
    return clearedAt !== null && time <= clearedAt;
}

/**
 * Has `userId` cleared everything that is in the chat (so the sidebar has no preview to show)?
 * A chat without a stored time that was cleared counts as cleared: the next message sets the time again.
 */
export function isChatClearedFor(chat: ChatTimes, userId: string | null | undefined): boolean {
    const clearedAt = getUserTime(chat.clearedAt, userId);
    if (clearedAt === null) return false;
    return typeof chat.time === "string" ? chat.time <= clearedAt : true;
}

/**
 * Is the chat out of `userId`'s list? It stays out until something NEWER than the deletion arrives (a message,
 * or a finished call): then it comes back holding only that.
 *
 * `locallyDeletedAt` is the deletion this browser just made and Firestore hasn't reported yet.
 */
export function isChatHiddenFor(chat: ChatTimes, userId: string | null | undefined, locallyDeletedAt?: string | null): boolean {
    const deletedAt = laterOf(getUserTime(chat.deletedAt, userId), locallyDeletedAt);
    if (deletedAt === null) return false;
    return typeof chat.time === "string" ? chat.time <= deletedAt : true;
}

/**
 * A chat document that exists only to hold a block (the two people never talked). It has no messages, no
 * `time` and no `updatedAt` (so it never shows in a sidebar), and it is not "a conversation" for any rule
 * that asks whether the two have talked before. It is deleted again when the last block on it is lifted.
 */
export function isPlaceholderChat(data: { time?: unknown; updatedAt?: unknown } | undefined): boolean {
    return !!data && typeof data.time !== "string" && data.updatedAt === undefined;
}
