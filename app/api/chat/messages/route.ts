import { after, NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdminDB } from "@/lib/config/firebase-admin";
import { MessageRequestSchema, type MessageRequest } from "@/components/chat/lib/schemas";
import { getAttachmentResourceType } from "@/components/chat/lib/attachments";
import { getMessagePreview } from "@/components/chat/lib/constants";
import { getChatId } from "@/components/chat/lib/chatId";
import { assertNotBlocked, deleteMessage, editMessage, markChatRead, reactToMessage, } from "@/components/chat/lib/messageOperations.server";
import { getUserTime, laterOf } from "@/components/chat/lib/chatState";
import { destroyUploadedAssets, resolveAttachments } from "@/components/chat/lib/attachments.server";
import { errorResponse, handleRouteError, parseBody, requireUser } from "@/components/chat/lib/http.server";
import type { MessageAttachment } from "@/components/chat/types";
import { newUnreadCounts, unreadIncrementUpdates, updateChat, } from "@/components/chat/lib/unread.server";
import { readUnreadTotal, writeUnreadTotal } from "@/components/chat/lib/unreadTotal.server";

type SendMessageRequest = Extract<MessageRequest, { action: "send" }>;

/**
 * Same send behaviour as before (the sender comes from the session), plus: the receiver's unread
 * counter goes up by one (`unreadCount.<receiverId>`; the sender's own counter is untouched), and so
 * does their centralized total (unreadMessageCount/{receiverId}) in the same transaction.
 *
 * A transaction instead of a blind batch: the chat is read first so that an old chat, which still
 * holds one shared numeric counter, is converted to the per-user shape instead of being incremented
 * as a number. The increment itself is FieldValue.increment on the receiver's own key.
 */
async function sendMessage(
    senderId: string,
    { receiverId, text }: SendMessageRequest,
    attachments: MessageAttachment[]
) {
    const chatId = getChatId(senderId, receiverId);
    const sentAt = new Date().toISOString();

    const chatRef = firebaseAdminDB.collection("chats").doc(chatId);
    const messagesRef = chatRef.collection("messages").doc();

    const displayLastMessage = getMessagePreview(text, attachments);
    const participants = [senderId, receiverId];

    await firebaseAdminDB.runTransaction(async (tx) => {
        // Reads must happen before writes inside a transaction.
        const chatSnap = await tx.get(chatRef);
        const receiverTotal = await readUnreadTotal(tx, receiverId);

        // A block made a moment ago is seen here, in the same transaction that would store the message.
        assertNotBlocked(chatSnap, senderId, receiverId);

        // A message is never older than a "clear chat" of either person. `sentAt` was taken before this
        // transaction started, so a clear that committed in between could otherwise hide a message that
        // was sent after it. (Only ever moves the time forward by a millisecond, and only in that race.)
        const clearedAt = chatSnap.exists
            ? laterOf(getUserTime(chatSnap.get("clearedAt"), senderId), getUserTime(chatSnap.get("clearedAt"), receiverId))
            : null;
        const now = clearedAt && sentAt <= clearedAt ? new Date(Date.parse(clearedAt) + 1).toISOString() : sentAt;

        tx.set(messagesRef, {
            id: messagesRef.id,
            senderId,
            receiverId,
            text,
            time: now,
            status: "sent",
            ...(attachments.length > 0 && { attachments }),
            createdAt: FieldValue.serverTimestamp(),
        });
        // Both branches below add exactly one unread message for the receiver.
        writeUnreadTotal(tx, receiverTotal, 1);

        if (!chatSnap.exists) {
            tx.set(chatRef, {
                id: chatId,
                participants,
                lastMessage: displayLastMessage,
                lastSenderId: senderId,
                time: now,
                isRead: false,
                unreadCount: newUnreadCounts(participants, receiverId),
                updatedAt: FieldValue.serverTimestamp(),
            });
            return;
        }

        updateChat(tx, chatRef, [
            ["id", chatId],
            ["participants", participants],
            ["lastMessage", displayLastMessage],
            ["lastSenderId", senderId],
            ["time", now],
            ["updatedAt", FieldValue.serverTimestamp()],
            ...unreadIncrementUpdates(chatSnap.get("unreadCount"), participants, receiverId),
        ]);
    });
}

/**
 * Message mutations. Body is a discriminated union on `action`:
 *   send (default) | edit | delete | react | markRead
 * The acting user is always taken from the authenticated session, never from the body.
 */
export async function PATCH(req: NextRequest) {
    try {
        const auth = await requireUser();
        if (auth.response) return auth.response;
        const { user } = auth;

        const parsed = await parseBody(req, MessageRequestSchema);
        if (parsed.response) return parsed.response;

        const request = parsed.data;
        const actorId = user.id;

        switch (request.action) {
            case "send": {
                if (request.senderId && request.senderId !== actorId) {
                    return errorResponse("SENDER_MISMATCH", "You can only send messages as yourself.", 403);
                }
                if (!request.text && !request.attachments?.length) {
                    return errorResponse("EMPTY_MESSAGE", "Message must contain text or an attachment.", 400);
                }
                // Checked against Cloudinary before anything is written: nothing is stored for a bad file.
                const attachments = await resolveAttachments(
                    actorId,
                    getChatId(actorId, request.receiverId),
                    request.attachments ?? []
                );
                await sendMessage(actorId, request, attachments);
                break;
            }
            case "edit":
                await editMessage({
                    actorId,
                    chatId: request.chatId,
                    messageId: request.messageId,
                    text: request.text,
                });
                break;
            case "delete": {
                const removed = await deleteMessage({ actorId, chatId: request.chatId, messageId: request.messageId });
                // The files go too, but after the response: the user doesn't wait for Cloudinary.
                const files = removed.flatMap((attachment) =>
                    attachment.publicId
                        ? [{ publicId: attachment.publicId, resourceType: getAttachmentResourceType(attachment) }]
                        : []
                );
                if (files.length > 0) after(() => destroyUploadedAssets(files));
                break;
            }
            case "react":
                await reactToMessage({
                    actorId,
                    chatId: request.chatId,
                    messageId: request.messageId,
                    reaction: request.reaction,
                });
                break;
            case "markRead":
                await markChatRead({ actorId, chatId: request.chatId });
                break;
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        return handleRouteError(
            error,
            "Error handling chat message request",
            "An internal server error occurred while processing the message."
        );
    }
}
