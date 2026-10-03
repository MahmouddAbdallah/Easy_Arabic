import type { MessageAttachment } from "../types";
import { formatDuration } from "./attachments";

export const MESSAGES_API_URL = "/api/chat/messages";

/**
 * Where the composer's toasts appear. The app-wide Toaster sits bottom-right, right on top of the
 * Send button, which would block pressing Send again after a failure.
 */
export const COMPOSER_TOAST_POSITION = "top-center" as const;

/** Upload tickets (POST) and clean-up of unsent uploads (DELETE). */
export const ATTACHMENTS_API_URL = "/api/chat/attachments";

/** Upper bound for edited text. (Sending is intentionally left as it was.) */
export const MAX_MESSAGE_LENGTH = 4096;

/** Shown in the bubble for a soft-deleted message. */
export const DELETED_MESSAGE_TEXT = "This message was deleted";

/** Shown in the sidebar when the latest message of a chat was deleted. */
export const DELETED_MESSAGE_PREVIEW = "🚫 This message was deleted";

const ATTACHMENT_PREVIEW: Record<MessageAttachment["type"], { icon: string; one: string; many: string }> = {
    image: { icon: "📷", one: "Photo", many: "photos" },
    video: { icon: "🎥", one: "Video", many: "videos" },
    audio: { icon: "🎤", one: "Voice message", many: "voice messages" },
    file: { icon: "📁", one: "File", many: "files" },
};

/**
 * Text used for the chat's `lastMessage` preview (sidebar). Same rule the send handler uses:
 * the text when there is one, otherwise a label for what was sent ("📷 Photo", "🎥 2 videos",
 * "🎤 Voice message (0:12)"...).
 */
export function getMessagePreview(
    text: string,
    attachments?: readonly Pick<MessageAttachment, "type" | "duration">[] | null
): string {
    if (text) return text;
    if (!attachments?.length) return "📁 File";

    if (new Set(attachments.map((attachment) => attachment.type)).size > 1) {
        return `📎 ${attachments.length} attachments`;
    }
    const { icon, one, many } = ATTACHMENT_PREVIEW[attachments[0].type];
    if (attachments.length > 1) return `${icon} ${attachments.length} ${many}`;

    // A voice message shows how long it is, like on every messenger.
    const length = attachments[0].type === "audio" ? formatDuration(attachments[0].duration) : "";
    return length ? `${icon} ${one} (${length})` : `${icon} ${one}`;
}
