import { z } from "zod";
import { ISO_TIME_PATTERN } from "./chatState";
import { firestoreId } from "./schemas";

/**
 * Request schema for POST /api/chat/conversations. The browser only needs the inferred types
 * (`import type`), so zod never reaches the client bundle. Unknown keys are rejected, so a typo fails loudly.
 *
 * Nothing here names a chat or the acting user: the actor is the signed-in user and the chat is always
 * "the actor's chat with `receiverId`", worked out on the server.
 */

/** Exactly what `toISOString()` produces: the only format that is also in the right order as plain text. */
const isoTime = z
    .string()
    .regex(ISO_TIME_PATTERN, "Invalid time")
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid time");

/**
 * "Up to the newest message I could see." The server never clears past what exists, so this only ever
 * makes the action smaller: a message that arrives while the confirmation is on screen is not wiped unseen,
 * and repeating the request (retry, second tab) can't swallow anything newer.
 */
const upTo = isoTime.optional();

export const ConversationRequestSchema = z.discriminatedUnion("action", [
    z.strictObject({ action: z.literal("block"), receiverId: firestoreId }),
    z.strictObject({ action: z.literal("unblock"), receiverId: firestoreId }),
    z.strictObject({ action: z.literal("clear"), receiverId: firestoreId, upTo }),
    z.strictObject({ action: z.literal("delete"), receiverId: firestoreId, upTo }),
]);

export type ConversationRequest = z.output<typeof ConversationRequestSchema>;
export type ConversationRequestInput = z.input<typeof ConversationRequestSchema>;
export type ConversationAction = ConversationRequest["action"];

/** Body of every successful response. Only the fields of the action that ran are set. */
export interface ConversationResponse {
    success: true;
    action: ConversationAction;
    /** block / unblock: whether the other person is blocked now. */
    blocked?: boolean;
    /** clear / delete: messages sent at or before this time are hidden for the user now; null when there was nothing to clear. */
    clearedAt?: string | null;
    /** delete: the chat is out of the user's list until something newer than this arrives; null when there was nothing to delete. */
    deletedAt?: string | null;
}
