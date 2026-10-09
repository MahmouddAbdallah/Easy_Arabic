/**
 * SERVER ONLY — uses firebase-admin. Never import this from a client component.
 *
 * Edit / delete / react / mark-read operations for chats. Each one runs in a Firestore
 * transaction so the checks (exists, participant, owner, not deleted) and the write are
 * atomic: e.g. a reaction can't land on a message that was deleted a moment earlier.
 */
import { FieldPath, FieldValue, type DocumentSnapshot, type Transaction } from "firebase-admin/firestore";
import { firebaseAdminDB } from "@/lib/config/firebase-admin";
import { getMessageAttachments, hasAttachments } from "./attachments";
import { getBlockStatus, getUserTime, isHiddenByClear } from "./chatState";
import { getChatId } from "./chatId";
import { DELETED_MESSAGE_PREVIEW, getMessagePreview } from "./constants";
import type { ReactionKey } from "./reactions";
import { getUnreadCount } from "./unread";
import { markReadUpdates, unreadIncrementUpdates, updateChat } from "./unread.server";
import { readUnreadTotal, writeUnreadTotal } from "./unreadTotal.server";
import type { MessageAttachment, StoredMessage } from "../types";

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

/** The chat must exist and the actor must be one of its participants. Returns the participants. */
export function assertParticipant(chatSnap: DocumentSnapshot, actorId: string): string[] {
    if (!chatSnap.exists) {
        throw new ChatApiError("CHAT_NOT_FOUND", "Chat not found.", 404);
    }

    const participants: unknown = chatSnap.get("participants");
    if (!Array.isArray(participants) || !participants.includes(actorId)) {
        throw new ChatApiError("NOT_A_PARTICIPANT", "You are not a participant in this chat.", 403);
    }

    return participants as string[];
}

/**
 * Nobody can message, react to or call somebody they blocked, or who blocked them. Reads the chat the
 * caller already loaded, so it can run INSIDE the transaction that would write: a block made a moment
 * earlier is seen, and the write never happens.
 *
 * The two refusals have different words on purpose: whoever blocked is told what to do about it, while
 * the other person only learns that the conversation is unavailable.
 */
export function assertNotBlocked(chatSnap: DocumentSnapshot, actorId: string, otherId: string) {
    if (!chatSnap.exists) return;

    const { byMe, byOther } = getBlockStatus(chatSnap.get("blocks"), actorId, otherId);
    if (byMe) {
        throw new ChatApiError("YOU_BLOCKED_USER", "You blocked this person. Unblock them to continue.", 403);
    }
    if (byOther) {
        throw new ChatApiError("CHAT_BLOCKED", "You can't contact this person right now.", 403);
    }
}

const USER_ID = /^[A-Za-z0-9_-]{1,200}$/;

/**
 * The same check for code that has no transaction of its own (signing an upload): one read, then the same
 * refusal. It is an early exit, not a guarantee; the write that really matters repeats it in its transaction.
 */
export async function assertCanContact(actorId: string, otherId: string) {
    if (!USER_ID.test(otherId)) throw new ChatApiError("INVALID_RECEIVER", "This person doesn't exist.", 400);

    const chatSnap = await firebaseAdminDB.collection("chats").doc(getChatId(actorId, otherId)).get();
    assertNotBlocked(chatSnap, actorId, otherId);
}

/**
 * Loads the chat + message and enforces: chat exists, actor is a participant, message exists.
 * The actor always comes from the verified session, never from the request body.
 */
async function loadMessage(tx: Transaction, actorId: string, chatId: string, messageId: string) {
    const chatRef = firebaseAdminDB.collection("chats").doc(chatId);
    const messageRef = chatRef.collection("messages").doc(messageId);

    const [chatSnap, messageSnap] = await Promise.all([tx.get(chatRef), tx.get(messageRef)]);

    const participants = assertParticipant(chatSnap, actorId);

    if (!messageSnap.exists) {
        throw new ChatApiError("MESSAGE_NOT_FOUND", "Message not found.", 404);
    }

    const message = messageSnap.data() as StoredMessage;
    // The entry a finished call leaves in the chat is history, not a message: nothing to edit, delete or react to.
    if (message.type === "call") {
        throw new ChatApiError("CALL_ENTRY", "Call history can't be changed.", 409);
    }

    return { chatRef, chatSnap, messageRef, participants, message };
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
        if (!text && !hasAttachments(message)) {
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
            tx.update(chatRef, { lastMessage: getMessagePreview(text, getMessageAttachments(message)) });
        }
    });
}

/**
 * Soft-deletes a message. Returns the attachments that were on it, so the caller can remove the
 * files from Cloudinary once the message is gone (empty when it was already deleted).
 */
export async function deleteMessage({ actorId, chatId, messageId }: BaseParams): Promise<MessageAttachment[]> {
    let removed: MessageAttachment[] = [];

    await firebaseAdminDB.runTransaction(async (tx) => {
        removed = []; // a transaction can run more than once
        const { chatRef, messageRef, message } = await loadMessage(tx, actorId, chatId, messageId);

        assertOwner(message, actorId, "delete");

        // Idempotent: deleting twice (double click, two tabs, a retry) is a success.
        if (message.deleted) return;

        const isLatest = await isLatestMessage(tx, chatRef, messageId);
        removed = getMessageAttachments(message);

        // Soft delete: the document stays in the timeline, but the content is erased
        // (not merely hidden) so it can't be read back through the Firestore client.
        tx.update(messageRef, {
            deleted: true,
            deletedAt: FieldValue.serverTimestamp(),
            text: "",
            attachments: FieldValue.delete(),
            attachment: FieldValue.delete(), // the single-attachment field older messages use
            reactions: FieldValue.delete(),
        });

        if (isLatest) {
            tx.update(chatRef, { lastMessage: DELETED_MESSAGE_PREVIEW });
        }
    });

    return removed;
}

/** Sets the actor's reaction to `reaction`, or removes it when `reaction` is null. Idempotent. */
export async function reactToMessage({
    actorId,
    chatId,
    messageId,
    reaction,
}: BaseParams & { reaction: ReactionKey | null }) {
    await firebaseAdminDB.runTransaction(async (tx) => {
        const { chatRef, chatSnap, messageRef, participants, message } = await loadMessage(
            tx,
            actorId,
            chatId,
            messageId
        );

        if (message.deleted) {
            throw new ChatApiError("MESSAGE_DELETED", "This message was deleted.", 409);
        }

        // Taking a reaction back is always fine; putting one on is contacting the other person.
        if (reaction !== null) {
            const otherId = participants.find((id) => id !== actorId);
            if (otherId) assertNotBlocked(chatSnap, actorId, otherId);
        }

        const current = message.reactions?.[actorId] ?? null;
        if (current === reaction) return;

        // A reaction to someone else's message is news for them: it counts as one unread event
        // for the message's author. Reacting to your own message doesn't, and taking a reaction
        // back never lowers anyone's count. Neither does a reaction to a message the author has
        // cleared from their own chat: they can't see it, so there is nothing to be told about.
        const hiddenForAuthor = isHiddenByClear(message.time, getUserTime(chatSnap.get("clearedAt"), message.senderId));
        const notifiesAuthor =
            reaction !== null &&
            message.senderId !== actorId &&
            participants.includes(message.senderId) &&
            !hiddenForAuthor;

        // Reads must happen before writes inside a transaction.
        const authorTotal = notifiesAuthor ? await readUnreadTotal(tx, message.senderId) : null;

        // FieldPath avoids any dot/escape surprises in the user id used as the map key.
        tx.update(messageRef, new FieldPath("reactions", actorId), reaction ?? FieldValue.delete());

        if (authorTotal) {
            updateChat(tx, chatRef, unreadIncrementUpdates(chatSnap.get("unreadCount"), participants, message.senderId));
            writeUnreadTotal(tx, authorTotal, 1);
        }
    });
}

/**
 * The actor has read the chat: clears the actor's own unread counter. Only that counter is written,
 * so it can't interfere with the other user's count, and `updatedAt` is left alone (reading a chat
 * must not reorder the sidebar). Idempotent: nothing is written when the count is already 0.
 *
 * The same number of unread messages is taken off the actor's centralized total
 * (unreadMessageCount/{actorId}) in the same transaction.
 */
export async function markChatRead({ actorId, chatId }: { actorId: string; chatId: string }) {
    await firebaseAdminDB.runTransaction(async (tx) => {
        const chatRef = firebaseAdminDB.collection("chats").doc(chatId);
        const chatSnap = await tx.get(chatRef);

        const participants = assertParticipant(chatSnap, actorId);

        const unreadCount = chatSnap.get("unreadCount");
        const updates = markReadUpdates(unreadCount, participants, actorId);
        if (!updates) return;

        // Reads must happen before writes inside a transaction.
        const actorTotal = await readUnreadTotal(tx, actorId);

        updateChat(tx, chatRef, updates);
        writeUnreadTotal(tx, actorTotal, -getUnreadCount(unreadCount, actorId));
    });
}
