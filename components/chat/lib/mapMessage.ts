import type { DocumentData } from "firebase/firestore";
import type { MessageType } from "../types";
import { getMessageAttachments } from "./attachments";
import { normalizeReactions } from "./reactions";

/** Accepts a Firestore Timestamp, an ISO string or a Date. Returns null for anything else. */
function toDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === "object" && typeof (value as { toDate?: unknown }).toDate === "function") {
        return (value as { toDate: () => Date }).toDate();
    }
    if (typeof value === "string") {
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
}

function formatTime(iso: unknown): string {
    const date = toDate(iso);
    return date ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
}

/** Firestore message document -> UI message. */
export function mapMessageDoc(id: string, data: DocumentData, currentUserId: string): MessageType {
    const deleted = data.deleted === true;

    return {
        id,
        senderId: data.senderId,
        // Deleted messages are cleared server-side; never render leftovers even if present.
        text: deleted ? "" : data.text || "",
        time: formatTime(data.time),
        isMe: data.senderId === currentUserId,
        status: data.status || "sent",
        // Handles both the `attachments` list and the single `attachment` older messages have.
        attachments: deleted ? [] : getMessageAttachments(data),
        edited: !deleted && data.edited === true,
        editedAt: toDate(data.editedAt),
        deleted,
        deletedAt: toDate(data.deletedAt),
        reactions: deleted ? {} : normalizeReactions(data.reactions),
    };
}
