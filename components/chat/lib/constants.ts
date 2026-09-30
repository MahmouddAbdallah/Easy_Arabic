import type { MessageAttachment } from "../types";

export const MESSAGES_API_URL = "/api/chat/messages";

/** Upper bound for edited text. (Sending is intentionally left as it was.) */
export const MAX_MESSAGE_LENGTH = 4096;

/** Shown in the bubble for a soft-deleted message. */
export const DELETED_MESSAGE_TEXT = "This message was deleted";

/** Shown in the sidebar when the latest message of a chat was deleted. */
export const DELETED_MESSAGE_PREVIEW = "🚫 This message was deleted";

/** Text used for the chat's `lastMessage` preview (sidebar). Same rule the send handler uses. */
export function getMessagePreview(
    text: string,
    attachment?: Pick<MessageAttachment, "type"> | null
): string {
    return text || (attachment?.type === "image" ? "📷 Photo" : "📁 File");
}
