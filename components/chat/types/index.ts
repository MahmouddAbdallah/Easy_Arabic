import type { ReactionMap } from "../lib/reactions";

/**
 * What an attachment is to the UI. `video` is a type of its own, not a generic file, and `audio` is a
 * voice message recorded in the chat (it can't be picked from the file chooser).
 */
export type AttachmentType = "image" | "video" | "audio" | "file";

/** Cloudinary's own asset kind. Documents are stored as `raw`; audio is stored as `video` (Cloudinary has no audio kind). */
export type CloudinaryResourceType = "image" | "video" | "raw";

/**
 * One attachment as stored in Firestore (chats/{chatId}/messages/{messageId}.attachments) and as
 * rendered by the UI. The file itself lives in Cloudinary; only this metadata is in Firestore.
 */
export interface MessageAttachment {
    type: AttachmentType;
    /**
     * Permanent Cloudinary https URL. Only missing on old messages whose attachment was a
     * temporary blob: URL that never worked for the other person.
     */
    url?: string;
    /** Cloudinary public id: the handle used to delete the file. */
    publicId?: string;
    resourceType?: CloudinaryResourceType;
    fileName?: string;
    /** Size in bytes. */
    fileSize?: number;
    mimeType?: string;
    width?: number;
    height?: number;
    /** Length in seconds (videos and voice messages). */
    duration?: number;
    /**
     * Voice messages only: how loud the recording was over time, one 0-100 value per bar, so the
     * player can draw its waveform without downloading or decoding the audio.
     */
    waveform?: number[];
}

/**
 * Everything the browser needs to upload ONE file straight to Cloudinary. Issued by
 * POST /api/chat/attachments after the server validated the file; carries a signature, never the secret.
 */
export interface UploadTicket {
    /** https://api.cloudinary.com/v1_1/<cloud>/<image|video|raw>/upload */
    uploadUrl: string;
    /** Form fields to send with the file, exactly as given (they are part of the signature). */
    fields: Record<string, string>;
    /** File name to use for the multipart `file` part. */
    fileName: string;
    type: AttachmentType;
    resourceType: CloudinaryResourceType;
}

export type UploadTicketResult =
    | { ok: true; ticket: UploadTicket }
    | { ok: false; code: string; message: string };

/** What Cloudinary reports back for a finished upload. Sent with the message so the server can verify it. */
export interface UploadedAsset {
    publicId: string;
    resourceType: CloudinaryResourceType;
    version: number;
    format?: string;
    bytes: number;
    width?: number;
    height?: number;
    duration?: number;
}

/** The single-attachment shape written before Cloudinary: `fileSize` was a label like "12.3 KB". */
export interface LegacyStoredAttachment {
    type?: "image" | "file";
    url?: string;
    fileName?: string;
    fileSize?: string;
}

/** Shape of a message as rendered by the UI (derived from the Firestore document). */
export interface MessageType {
    id: string;
    senderId: string;
    text: string;
    /** Formatted send time. Never changes when a message is edited. */
    time: string;
    isMe: boolean;
    status?: "sent" | "delivered" | "read";
    /** Empty for text-only messages. Old single `attachment` documents are mapped into this list. */
    attachments: MessageAttachment[];
    edited: boolean;
    editedAt: Date | null;
    deleted: boolean;
    deletedAt: Date | null;
    reactions: ReactionMap;
}

/**
 * Shape of a message document at chats/{chatId}/messages/{messageId}.
 * Timestamps written by the server (createdAt/editedAt/deletedAt) are Firestore Timestamps.
 */
export interface StoredMessage {
    id: string;
    senderId: string;
    receiverId: string;
    text: string;
    /** ISO string, set once on send. Messages are ordered by this field. */
    time: string;
    status?: "sent" | "delivered" | "read";
    attachments?: MessageAttachment[];
    /** @deprecated Written before attachments moved to Cloudinary; still read for old messages. */
    attachment?: LegacyStoredAttachment;
    createdAt?: unknown;
    edited?: boolean;
    editedAt?: unknown;
    deleted?: boolean;
    deletedAt?: unknown;
    reactions?: Record<string, string>;
}
