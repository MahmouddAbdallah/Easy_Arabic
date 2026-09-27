import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdminDB } from "@/lib/config/firebase-admin";

const AttachmentSchema = z.object({
    type: z.enum(["image", "file"]),
    url: z.string().url().optional(),
    fileName: z.string().optional(),
    fileSize: z.string().optional(),
});

const SendMessageSchema = z.object({
    senderId: z.string().min(1, "senderId is required"),
    receiverId: z.string().min(1, "receiverId is required"),
    text: z.string().default(""),
    attachment: AttachmentSchema.optional(),
});

function generateChatId(id1: string, id2: string): string {
    return [id1, id2].sort().join("_");
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const validation = SendMessageSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Invalid payload provided",
                        details: validation.error.flatten().fieldErrors,
                    },
                },
                { status: 400 }
            );
        }

        const { senderId, receiverId, text, attachment } = validation.data;

        if (!text && !attachment) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "EMPTY_MESSAGE",
                        message: "Message must contain text or an attachment.",
                    },
                },
                { status: 400 }
            );
        }

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

        const displayLastMessage =
            text || (attachment?.type === "image" ? "📷 Photo" : "📁 File");

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

        return NextResponse.json(
            {
                success: true,
                data: {
                    chatId,
                    messageId: messagesRef.id,
                    sentAt: now,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error sending message:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "SERVER_ERROR",
                    message: "An internal server error occurred while sending the message.",
                },
            },
            { status: 500 }
        );
    }
}