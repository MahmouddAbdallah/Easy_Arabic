import { z } from "zod";
import { MAX_MESSAGE_LENGTH } from "./constants";
import { REACTION_KEYS } from "./reactions";

/**
 * Request schemas for PATCH /api/chat/messages.
 * The client only needs the inferred types (`import type`), so zod never reaches the browser bundle.
 */

// Firestore document ids: no slashes, and the `__name__` form is reserved.
const firestoreId = z
    .string()
    .min(1)
    .max(200)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid id")
    .refine((id) => !/^__.*__$/.test(id), "Invalid id");

export const AttachmentSchema = z.object({
    type: z.enum(["image", "file"]),
    url: z.string().url().optional(),
    fileName: z.string().optional(),
    fileSize: z.string().optional(),
});

const SendMessageSchema = z.object({
    action: z.literal("send"),
    /**
     * Deprecated: the sender is always the authenticated user. Older clients still send it;
     * it is only accepted if it matches the session.
     */
    senderId: z.string().optional(),
    receiverId: z.string().min(1, "receiverId is required"),
    text: z.string().default(""),
    attachment: AttachmentSchema.optional(),
});

const EditMessageSchema = z.object({
    action: z.literal("edit"),
    chatId: firestoreId,
    messageId: firestoreId,
    text: z.string().trim().max(MAX_MESSAGE_LENGTH, `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)`),
});

const DeleteMessageSchema = z.object({
    action: z.literal("delete"),
    chatId: firestoreId,
    messageId: firestoreId,
});

const ReactMessageSchema = z.object({
    action: z.literal("react"),
    chatId: firestoreId,
    messageId: firestoreId,
    /** The reaction the user wants to have on the message, or null to remove theirs. */
    reaction: z.enum(REACTION_KEYS).nullable(),
});

/** A body without `action` is treated as "send" so the existing send payload keeps working. */
export const MessageRequestSchema = z.preprocess(
    (body) =>
        body && typeof body === "object" && !Array.isArray(body) && !("action" in body)
            ? { ...body, action: "send" }
            : body,
    z.discriminatedUnion("action", [
        SendMessageSchema,
        EditMessageSchema,
        DeleteMessageSchema,
        ReactMessageSchema,
    ])
);

export type MessageRequest = z.output<typeof MessageRequestSchema>;
export type EditMessageRequest = z.output<typeof EditMessageSchema>;
export type DeleteMessageRequest = z.output<typeof DeleteMessageSchema>;
export type ReactMessageRequest = z.output<typeof ReactMessageSchema>;
