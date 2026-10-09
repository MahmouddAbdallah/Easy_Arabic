/**
 * SERVER ONLY — uses firebase-admin and the database. Never import this from a client component.
 *
 * Block / unblock / clear / delete for ONE person's side of a conversation. Every operation:
 *
 *  - takes the acting user from the session and works out the chat itself (`getChatId(actor, receiver)`):
 *    the browser never names a chat or a user to act as;
 *  - runs as one Firestore transaction, so the checks and the write can't be separated by another request;
 *  - changes only the actor's own entry (`blocks.<actor>`, `clearedAt.<actor>`, `deletedAt.<actor>`), so the
 *    other person's history, list and unread counter are never touched;
 *  - is idempotent: repeating it (double click, retry, two tabs) is a success that changes nothing more.
 *
 * Nothing is physically deleted. Clearing and deleting move the actor's own "history starts here" marker
 * (see ./chatState.ts); the messages, and the files attached to them, stay for the other person.
 */
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { firebaseAdminDB } from "@/lib/config/firebase-admin";
import { db } from "@/prisma/db";
import { peerIdOf } from "./callMachine";
import { endCall, getCurrentCall } from "./callOperations.server";
import { getChatId } from "./chatId";
import { earlierOf, getUserTime, isPlaceholderChat, laterOf, readUserTimes } from "./chatState";
import { ChatApiError, assertParticipant } from "./messageOperations.server";
import { getUnreadCount } from "./unread";
import { markReadUpdates, updateChat, type ChatUpdate } from "./unread.server";
import { readUnreadTotal, writeUnreadTotal } from "./unreadTotal.server";

interface PairParams {
    /** The signed-in user. */
    actorId: string;
    /** The other person of the conversation. */
    receiverId: string;
}

const chatRefOf = (actorId: string, receiverId: string) =>
    firebaseAdminDB.collection("chats").doc(getChatId(actorId, receiverId));

function assertOtherPerson({ actorId, receiverId }: PairParams) {
    if (actorId === receiverId) {
        throw new ChatApiError("INVALID_RECEIVER", "You can't do that with yourself.", 400);
    }
}

/* -------------------------------------------------------------------------------------------------
 * Blocking
 * ---------------------------------------------------------------------------------------------- */

/** If the two are in a call right now, it ends: blocking someone must not leave them on the line. */
async function hangUpCallWith({ actorId, receiverId }: PairParams) {
    try {
        const current = await getCurrentCall(actorId);
        if (!current || peerIdOf(current.record, actorId) !== receiverId) return;
        // No "missed call" push for the other side: they are being blocked, not stood up.
        await endCall({ callId: current.record.id, actorId, reason: "hangup" });
    } catch (error) {
        // The block itself is already stored and every new call is refused; a stale one times out by itself.
        console.error("[chat] Couldn't end the call after blocking:", error);
    }
}

/**
 * Blocks `receiverId`: from now on neither of the two can message, react to or call the other.
 * Their history stays as it is. Works before the two have ever talked (the block then lives on a
 * placeholder chat document, see isPlaceholderChat).
 */
export async function blockUser(params: PairParams): Promise<void> {
    assertOtherPerson(params);
    const { actorId, receiverId } = params;

    // A block on an id that isn't anybody would only leave junk behind.
    const target = await db.orm.public.User.where({ id: receiverId }).select("id").first();
    if (!target) throw new ChatApiError("USER_NOT_FOUND", "This person doesn't exist.", 404);

    const chatRef = chatRefOf(actorId, receiverId);
    const now = new Date().toISOString();

    await firebaseAdminDB.runTransaction(async (tx) => {
        const chatSnap = await tx.get(chatRef);

        if (!chatSnap.exists) {
            tx.set(chatRef, { id: chatRef.id, participants: [actorId, receiverId], blocks: { [actorId]: now } });
            return;
        }

        assertParticipant(chatSnap, actorId);
        if (getUserTime(chatSnap.get("blocks"), actorId)) return; // already blocked

        // FieldPath: the user id is a map key, not part of a dotted path.
        tx.update(chatRef, new FieldPath("blocks", actorId), now);
    });

    await hangUpCallWith(params);
}

/** Lifts the actor's own block. The other person's block of the actor (if any) is a separate entry and stays. */
export async function unblockUser(params: PairParams): Promise<void> {
    assertOtherPerson(params);
    const { actorId, receiverId } = params;
    const chatRef = chatRefOf(actorId, receiverId);

    await firebaseAdminDB.runTransaction(async (tx) => {
        const chatSnap = await tx.get(chatRef);
        if (!chatSnap.exists) return;

        assertParticipant(chatSnap, actorId);
        const blocks = readUserTimes(chatSnap.get("blocks"));
        if (!blocks[actorId]) return; // not blocked

        // A document that only existed to hold blocks leaves with the last of them.
        const othersLeft = Object.keys(blocks).some((blockerId) => blockerId !== actorId);
        if (!othersLeft && isPlaceholderChat(chatSnap.data())) {
            tx.delete(chatRef);
            return;
        }

        tx.update(chatRef, new FieldPath("blocks", actorId), FieldValue.delete());
    });
}

/* -------------------------------------------------------------------------------------------------
 * Clearing and deleting
 * ---------------------------------------------------------------------------------------------- */

export interface HistoryRemoval {
    /** Messages sent at or before this time are hidden for the actor; null when there was nothing to clear. */
    clearedAt: string | null;
    /** Delete only: the chat is out of the actor's list until something newer arrives; null otherwise. */
    deletedAt: string | null;
}

interface RemoveHistoryParams extends PairParams {
    /** The newest message the person could see when they confirmed. Never trusted beyond what exists. */
    upTo?: string;
    /** Delete = clear + take the chat out of the list. */
    hideChat: boolean;
}

/**
 * Moves the actor's "history starts here" marker up to `upTo` (default: the newest message there is), and,
 * for a delete, takes the chat out of their list. Both only ever move FORWARD, which is what makes a repeat
 * harmless: it can't hide a message that is newer than what the first request covered.
 *
 * When the marker now covers everything, the actor's unread counter (and their centralized total) is cleared
 * in the same transaction, the way reading the chat would have.
 */
async function removeHistory({ actorId, receiverId, upTo, hideChat }: RemoveHistoryParams): Promise<HistoryRemoval> {
    assertOtherPerson({ actorId, receiverId });
    const chatRef = chatRefOf(actorId, receiverId);
    const now = new Date().toISOString();

    return firebaseAdminDB.runTransaction(async (tx): Promise<HistoryRemoval> => {
        const chatSnap = await tx.get(chatRef);

        // The two never talked: there is nothing to clear and nothing to remove from a list.
        if (!chatSnap.exists || isPlaceholderChat(chatSnap.data())) return { clearedAt: null, deletedAt: null };
        const participants = assertParticipant(chatSnap, actorId);

        // The newest message that really exists (the chat's own `time` can lag behind a write that landed late).
        const newest = await tx.get(chatRef.collection("messages").orderBy("time", "desc").limit(1));
        const newestTime: unknown = newest.docs[0]?.get("time");
        const lastTime: unknown = chatSnap.get("time");
        const lastActivity = laterOf(
            typeof newestTime === "string" ? newestTime : null,
            typeof lastTime === "string" ? lastTime : null
        );

        const clearedBefore = getUserTime(chatSnap.get("clearedAt"), actorId);
        const deletedBefore = getUserTime(chatSnap.get("deletedAt"), actorId);

        // A chat with no messages has nothing to clear; it can still be taken out of the list.
        if (lastActivity === null && !hideChat) return { clearedAt: clearedBefore, deletedAt: deletedBefore };

        // Never past what exists: a marker in the future would swallow (and reorder) every message sent after it.
        const target = earlierOf(upTo, lastActivity ?? now) as string;

        const clearedAt = laterOf(clearedBefore, target) as string;
        const deletedAt = hideChat ? laterOf(deletedBefore, clearedAt) : deletedBefore;

        // Everything is cleared: the actor has nothing left unread in this chat.
        const coversEverything = lastActivity === null || clearedAt >= lastActivity;
        const unreadUpdates = coversEverything ? markReadUpdates(chatSnap.get("unreadCount"), participants, actorId) : null;
        // Reads must happen before writes inside a transaction.
        const total = unreadUpdates ? await readUnreadTotal(tx, actorId) : null;

        const updates: ChatUpdate[] = [];
        if (clearedAt !== clearedBefore) updates.push([new FieldPath("clearedAt", actorId), clearedAt]);
        if (hideChat && deletedAt !== deletedBefore) updates.push([new FieldPath("deletedAt", actorId), deletedAt]);
        if (unreadUpdates) updates.push(...unreadUpdates);
        updateChat(tx, chatRef, updates);
        if (total) writeUnreadTotal(tx, total, -getUnreadCount(chatSnap.get("unreadCount"), actorId));

        return { clearedAt, deletedAt: hideChat ? deletedAt : null };
    });
}

/** "Clear chat": the actor's view of the conversation starts empty. The other person keeps everything. */
export const clearChat = (params: PairParams & { upTo?: string }) => removeHistory({ ...params, hideChat: false });

/**
 * "Delete chat": clears the actor's view and takes the conversation out of their list. If the other person
 * writes again it comes back, holding only what is new.
 */
export const deleteChat = (params: PairParams & { upTo?: string }) => removeHistory({ ...params, hideChat: true });
