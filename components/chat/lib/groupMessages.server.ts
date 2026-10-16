/**
 * SERVER ONLY — uses firebase-admin. Never import this from a client component.
 *
 * Sending a message to a group. The message is stored exactly like one of a direct chat (chats/{id}/messages/{id}),
 * so reading, editing, deleting, reacting to it and marking the chat as read need nothing group-specific: those
 * operations (./messageOperations.server.ts) only need the chat id and its participants.
 *
 * What a group send adds to a direct one is that there are several people to tell:
 *   - every member but the sender gets +1 on their own counter (`unreadCount.<id>`) in the chat, and +1 on their
 *     centralized total (unreadMessageCount/<id>), all in ONE transaction, so none of it can drift or count twice;
 *   - nobody can block anybody inside a group (a block belongs to a direct chat), so there is no block check.
 */
import { FieldValue, type DocumentSnapshot } from "firebase-admin/firestore";
import { firebaseAdminDB } from "@/lib/config/firebase-admin";
import { getMessagePreview } from "./constants";
import { ChatApiError } from "./messageOperations.server";
import { groupUnreadUpdates } from "./groupUnread.server";
import { updateChat } from "./unread.server";
import { readUnreadTotal, writeUnreadTotal } from "./unreadTotal.server";
import type { MessageAttachment } from "../types";

/** The chat must be a group and the actor must be in it. Returns everybody in the group. */
export function assertGroupMember(chatSnap: DocumentSnapshot, actorId: string): string[] {
    if (!chatSnap.exists || chatSnap.get("category") !== "group") {
        throw new ChatApiError("GROUP_NOT_FOUND", "This group doesn't exist.", 404);
    }

    const participants: unknown = chatSnap.get("participants");
    if (!Array.isArray(participants) || !participants.includes(actorId)) {
        throw new ChatApiError("NOT_A_MEMBER", "You're not a member of this group.", 403);
    }
    return participants as string[];
}

export interface GroupMessageSent {
    groupName: string;
    /** Everybody who has to hear about it: all the members but the sender. */
    recipientIds: string[];
}

/** Stores the message and moves the group to the top of everybody's list. The attachments are already verified. */
export async function sendGroupMessage({
    actorId,
    groupId,
    text,
    attachments,
}: {
    actorId: string;
    groupId: string;
    text: string;
    attachments: readonly MessageAttachment[];
}): Promise<GroupMessageSent> {
    const sentAt = new Date().toISOString();
    const chatRef = firebaseAdminDB.collection("chats").doc(groupId);
    const messageRef = chatRef.collection("messages").doc();
    const preview = getMessagePreview(text, attachments);

    return firebaseAdminDB.runTransaction(async (tx) => {
        // Reads must happen before writes inside a transaction.
        const chatSnap = await tx.get(chatRef);
        const participants = assertGroupMember(chatSnap, actorId);
        const recipientIds = participants.filter((id) => id !== actorId);
        const totals = await Promise.all(recipientIds.map((id) => readUnreadTotal(tx, id)));

        tx.set(messageRef, {
            id: messageRef.id,
            senderId: actorId,
            text,
            time: sentAt,
            status: "sent",
            ...(attachments.length > 0 && { attachments }),
            createdAt: FieldValue.serverTimestamp(),
        });
        for (const total of totals) writeUnreadTotal(tx, total, 1);

        updateChat(tx, chatRef, [
            ["lastMessage", preview],
            ["lastSenderId", actorId],
            ["time", sentAt],
            ["updatedAt", FieldValue.serverTimestamp()],
            ...groupUnreadUpdates(chatSnap.get("unreadCount"), participants, recipientIds),
        ]);

        return { groupName: String(chatSnap.get("name") ?? "Group"), recipientIds };
    });
}
