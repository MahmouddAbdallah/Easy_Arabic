import { z } from "zod";
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE, MAX_WAVEFORM_BARS } from "./attachments";
import { MAX_MESSAGE_LENGTH } from "./constants";
import { REACTION_KEYS } from "./reactions";

/**
 * Request schemas for PATCH /api/chat/messages and /api/chat/attachments.
 * The client only needs the inferred types (`import type`), so zod never reaches the browser bundle.
 */

// Firestore document ids: no slashes, and the `__name__` form is reserved.
const firestoreId = z
    .string()
    .min(1)
    .max(200)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid id")
    .refine((id) => !/^__.*__$/.test(id), "Invalid id");

/**
 * An attachment sent with a message: the handle of a file the sender already uploaded to Cloudinary,
 * plus what Cloudinary reported about it. The server re-checks all of it (ownership, existence,
 * real size/type) before anything is stored; it never takes a URL from the client.
 */
export const SendAttachmentSchema = z.object({
    publicId: z.string().min(1).max(300),
    resourceType: z.enum(["image", "video", "raw"]),
    /** Cloudinary's asset version (a unix timestamp). */
    version: z.number().int().positive().max(9_999_999_999_999),
    format: z.string().regex(/^[A-Za-z0-9]{1,10}$/).optional(),
    fileName: z.string().min(1).max(1024),
    fileSize: z.number().int().positive().max(Math.max(...Object.values(MAX_ATTACHMENT_BYTES))).optional(),
    width: z.number().int().positive().max(100_000).optional(),
    height: z.number().int().positive().max(100_000).optional(),
    /** Seconds. */
    duration: z.number().positive().max(24 * 60 * 60).optional(),
    /**
     * "voice": a voice message recorded in the chat. It is checked against the audio allow-list
     * instead of the photo/video/document one, and is stored as an `audio` attachment.
     */
    kind: z.literal("voice").optional(),
    /** Voice messages only: loudness over time, one 0-100 value per bar (the player draws it). */
    waveform: z.array(z.number().int().min(0).max(100)).min(1).max(MAX_WAVEFORM_BARS).optional(),
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
    attachments: z
        .array(SendAttachmentSchema)
        .max(MAX_ATTACHMENTS_PER_MESSAGE, `You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files to a message`)
        .optional(),
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

/** The current user has read the chat: clears their own unread counter. */
const MarkReadSchema = z.object({
    action: z.literal("markRead"),
    chatId: firestoreId,
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
        MarkReadSchema,
    ])
);

/**
 * POST /api/chat/attachments: "I want to upload these files to the chat with `receiverId`".
 * Only descriptions of the files are sent (never the files), so the server can validate before signing.
 */
export const SignUploadsRequestSchema = z.object({
    receiverId: z.string().min(1, "receiverId is required").max(200),
    files: z
        .array(
            z.object({
                name: z.string().min(1).max(1024),
                size: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
                mimeType: z.string().max(255).default(""),
                /** "voice" when the file is a recording made in the chat: it gets the audio checks. */
                kind: z.literal("voice").optional(),
            })
        )
        .min(1, "Choose at least one file")
        .max(MAX_ATTACHMENTS_PER_MESSAGE, `You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files at a time`),
});

/** DELETE /api/chat/attachments: drop a file that was uploaded but never sent. */
export const DeleteUploadRequestSchema = z.object({
    publicId: z.string().min(1).max(300),
    resourceType: z.enum(["image", "video", "raw"]),
});

export type MessageRequest = z.output<typeof MessageRequestSchema>;
export type SendAttachmentInput = z.output<typeof SendAttachmentSchema>;
export type SignUploadsRequest = z.output<typeof SignUploadsRequestSchema>;
export type DeleteUploadRequest = z.output<typeof DeleteUploadRequestSchema>;
export type EditMessageRequest = z.output<typeof EditMessageSchema>;
export type DeleteMessageRequest = z.output<typeof DeleteMessageSchema>;
export type ReactMessageRequest = z.output<typeof ReactMessageSchema>;
export type MarkReadRequest = z.output<typeof MarkReadSchema>;
