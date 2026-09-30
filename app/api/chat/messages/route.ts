import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdminDB } from "@/lib/config/firebase-admin";
import { authorization } from "@/lib/verifyAuth";
import { MessageRequestSchema, type MessageRequest } from "@/components/chat/lib/schemas";
import { getMessagePreview } from "@/components/chat/lib/constants";
import {
    ChatApiError,
    deleteMessage,
    editMessage,
    reactToMessage,
} from "@/components/chat/lib/messageOperations.server";

function errorResponse(code: string, message: string, status: number, details?: unknown) {
    return NextResponse.json(
        { success: false, error: { code, message, ...(details ? { details } : {}) } },
        { status }
    );
}

function generateChatId(id1: string, id2: string): string {
    return [id1, id2].sort().join("_");
}

type SendMessageRequest = Extract<MessageRequest, { action: "send" }>;

const UNAUTHENTICATED_CODES = ["NO_TOKEN", "TOKEN_EXPIRED", "INVALID_TOKEN", "USER_NOT_FOUND"];

/** Existing send behaviour, unchanged — except the sender now comes from the session. */
async function sendMessage(senderId: string, { receiverId, text, attachment }: SendMessageRequest) {
    const chatId = generateChatId(senderId, receiverId);
    const now = new Date().toISOString();

    const chatRef = firebaseAdminDB.collection("chats").doc(chatId);
    const messagesRef = chatRef.collection("messages").doc();

    const newMessage = {
        id: messagesRef.id,
        senderId,
        receiverId,
        text,
        time: now,
        status: "sent",
        ...(attachment && { attachment }),
        createdAt: FieldValue.serverTimestamp(),
    };

    const displayLastMessage = getMessagePreview(text, attachment);

    const batch = firebaseAdminDB.batch();

    batch.set(messagesRef, newMessage);

    batch.set(
        chatRef,
        {
            id: chatId,
            participants: [senderId, receiverId],
            lastMessage: displayLastMessage,
            lastSenderId: senderId,
            time: now,
            isRead: false,
            unreadCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
    );

    await batch.commit();
}

/**
 * Message mutations. Body is a discriminated union on `action`:
 *   send (default) | edit | delete | react
 * The acting user is always taken from the authenticated session, never from the body.
 */
export async function PATCH(req: NextRequest) {
    try {
        const { error: authError, user } = await authorization();
        if (authError || !user) {
            const code = authError?.code ?? "NO_TOKEN";
            const status = UNAUTHENTICATED_CODES.includes(code) ? 401 : code === "SERVER_ERROR" ? 500 : 403;
            return errorResponse(code, authError?.message ?? "You're not logged in.", status);
        }

        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return errorResponse("INVALID_JSON", "Request body must be valid JSON.", 400);
        }

        const validation = MessageRequestSchema.safeParse(body);
        if (!validation.success) {
            return errorResponse(
                "VALIDATION_ERROR",
                "Invalid payload provided",
                400,
                z.flattenError(validation.error).fieldErrors
            );
        }

        const request = validation.data;
        const actorId = user.id;

        switch (request.action) {
            case "send": {
                if (request.senderId && request.senderId !== actorId) {
                    return errorResponse("SENDER_MISMATCH", "You can only send messages as yourself.", 403);
                }
                if (!request.text && !request.attachment) {
                    return errorResponse("EMPTY_MESSAGE", "Message must contain text or an attachment.", 400);
                }
                await sendMessage(actorId, request);
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
            case "delete":
                await deleteMessage({ actorId, chatId: request.chatId, messageId: request.messageId });
                break;
            case "react":
                await reactToMessage({
                    actorId,
                    chatId: request.chatId,
                    messageId: request.messageId,
                    reaction: request.reaction,
                });
                break;
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        if (error instanceof ChatApiError) {
            return errorResponse(error.code, error.message, error.status);
        }
        console.error("Error handling chat message request:", error);
        return errorResponse(
            "SERVER_ERROR",
            "An internal server error occurred while processing the message.",
            500
        );
    }
}
