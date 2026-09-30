import type { ReactionMap } from "../lib/reactions";

export interface MessageAttachment {
    type: "image" | "file";
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
    attachment?: MessageAttachment;
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
    attachment?: MessageAttachment;
    createdAt?: unknown;
    edited?: boolean;
    editedAt?: unknown;
    deleted?: boolean;
    deletedAt?: unknown;
    reactions?: Record<string, string>;
}
