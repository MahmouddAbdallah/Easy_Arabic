/**
 * SERVER ONLY — uses firebase-admin. Never import this from a client component.
 *
 * Edit / delete / react operations for chat messages. Each one runs in a Firestore
 * transaction so the checks (exists, participant, owner, not deleted) and the write are
 * atomic: e.g. a reaction can't land on a message that was deleted a moment earlier.
 */
import { FieldPath, FieldValue, type Transaction } from "firebase-admin/firestore";
import { firebaseAdminDB } from "@/lib/config/firebase-admin";
import { DELETED_MESSAGE_PREVIEW, getMessagePreview } from "./constants";
import type { ReactionKey } from "./reactions";
import type { StoredMessage } from "../types";

export class ChatApiError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly status: number
    ) {
        super(message);
        this.name = "ChatApiError";
    }
}

/**
 * Loads the chat + message and enforces: chat exists, actor is a participant, message exists.
 * The actor always comes from the verified session, never from the request body.
 */
async function loadMessage(tx: Transaction, actorId: string, chatId: string, messageId: string) {
    const chatRef = firebaseAdminDB.collection("chats").doc(chatId);
    const messageRef = chatRef.collection("messages").doc(messageId);

    const [chatSnap, messageSnap] = await Promise.all([tx.get(chatRef), tx.get(messageRef)]);

    if (!chatSnap.exists) {
        throw new ChatApiError("CHAT_NOT_FOUND", "Chat not found.", 404);
    }

    const participants: unknown = chatSnap.get("participants");
    if (!Array.isArray(participants) || !participants.includes(actorId)) {
        throw new ChatApiError("NOT_A_PARTICIPANT", "You are not a participant in this chat.", 403);
    }

    if (!messageSnap.exists) {
        throw new ChatApiError("MESSAGE_NOT_FOUND", "Message not found.", 404);
    }

    return { chatRef, messageRef, message: messageSnap.data() as StoredMessage };
}

/** Is this the newest message of the chat (i.e. the one the sidebar preview shows)? */
async function isLatestMessage(
    tx: Transaction,
    chatRef: FirebaseFirestore.DocumentReference,
    messageId: string
) {
    const latest = await tx.get(chatRef.collection("messages").orderBy("time", "desc").limit(1));
    return latest.docs[0]?.id === messageId;
}

function assertOwner(message: StoredMessage, actorId: string, verb: "edit" | "delete") {
    if (message.senderId !== actorId) {
        throw new ChatApiError("NOT_MESSAGE_OWNER", `You can only ${verb} your own messages.`, 403);
    }
}

interface BaseParams {
    actorId: string;
    chatId: string;
    messageId: string;
}

export async function editMessage({ actorId, chatId, messageId, text }: BaseParams & { text: string }) {
    await firebaseAdminDB.runTransaction(async (tx) => {
        const { chatRef, messageRef, message } = await loadMessage(tx, actorId, chatId, messageId);

        assertOwner(message, actorId, "edit");

        if (message.deleted) {
            throw new ChatApiError("MESSAGE_DELETED", "This message was deleted.", 409);
        }
        // A text-only message can't be emptied (that's what delete is for); a caption can.
        if (!text && !message.attachment) {
            throw new ChatApiError("EMPTY_MESSAGE", "Message text cannot be empty.", 400);
        }
        // Nothing changed: don't flag it as edited.
        if (text === message.text) return;

        // Reads must happen before writes inside a transaction.
        const isLatest = await isLatestMessage(tx, chatRef, messageId);

        // `time` is intentionally untouched so the message keeps its original timestamp.
        tx.update(messageRef, {
            text,
            edited: true,
            editedAt: FieldValue.serverTimestamp(),
        });

        // Keep the sidebar preview in sync (don't touch updatedAt: editing shouldn't reorder chats).
        if (isLatest) {
            tx.update(chatRef, { lastMessage: getMessagePreview(text, message.attachment) });
        }
    });
}

export async function deleteMessage({ actorId, chatId, messageId }: BaseParams) {
    await firebaseAdminDB.runTransaction(async (tx) => {
        const { chatRef, messageRef, message } = await loadMessage(tx, actorId, chatId, messageId);

        assertOwner(message, actorId, "delete");

        // Idempotent: deleting twice (double click, two tabs, a retry) is a success.
        if (message.deleted) return;

        const isLatest = await isLatestMessage(tx, chatRef, messageId);

        // Soft delete: the document stays in the timeline, but the content is erased
        // (not merely hidden) so it can't be read back through the Firestore client.
        tx.update(messageRef, {
            deleted: true,
            deletedAt: FieldValue.serverTimestamp(),
            text: "",
            attachment: FieldValue.delete(),
            reactions: FieldValue.delete(),
        });

        if (isLatest) {
            tx.update(chatRef, { lastMessage: DELETED_MESSAGE_PREVIEW });
        }
    });
}

/** Sets the actor's reaction to `reaction`, or removes it when `reaction` is null. Idempotent. */
export async function reactToMessage({
    actorId,
    chatId,
    messageId,
    reaction,
}: BaseParams & { reaction: ReactionKey | null }) {
    await firebaseAdminDB.runTransaction(async (tx) => {
        const { messageRef, message } = await loadMessage(tx, actorId, chatId, messageId);

        if (message.deleted) {
            throw new ChatApiError("MESSAGE_DELETED", "This message was deleted.", 409);
        }

        const current = message.reactions?.[actorId] ?? null;
        if (current === reaction) return;

        // FieldPath avoids any dot/escape surprises in the user id used as the map key.
        tx.update(messageRef, new FieldPath("reactions", actorId), reaction ?? FieldValue.delete());
    });
}
