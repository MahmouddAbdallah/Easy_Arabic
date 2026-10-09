"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseClientDB } from "@/lib/config/firebase-client";
import { getBlockStatus, getUserTime, laterOf } from "../lib/chatState";

/** What the current user's side of the open conversation looks like (see lib/chatState.ts). */
export interface ConversationState {
    /**
     * The chat document has answered at least once. Messages must not be read before it has: which ones
     * the user may see depends on `clearedAt`, and reading first would flash messages they cleared.
     */
    ready: boolean;
    /** Messages sent at or before this time are hidden for the current user; null when nothing was cleared. */
    clearedAt: string | null;
    /** The current user blocked the other person. */
    blockedByMe: boolean;
    /** The other person blocked the current user. */
    blockedByOther: boolean;
    /** Either of the two: nothing can be sent, reacted to or called. */
    blocked: boolean;
}

/** What this browser knows to be true before Firestore has reported it (the action's own response). */
export interface LocalConversationChange {
    clearedAt?: string | null;
    blockedByMe?: boolean;
}

export interface ConversationStateHandle extends ConversationState {
    /**
     * Applies the result of an action right away instead of waiting for the chat document to come back
     * with it (a few hundred ms). The next snapshot always replaces it, so it can't outlive the truth.
     */
    applyLocal: (change: LocalConversationChange) => void;
}

interface Remote {
    chatId: string;
    clearedAt: string | null;
    blockedByMe: boolean;
    blockedByOther: boolean;
}

interface Local extends LocalConversationChange {
    chatId: string;
}

const NOT_READY: ConversationState = {
    ready: false,
    clearedAt: null,
    blockedByMe: false,
    blockedByOther: false,
    blocked: false,
};

/**
 * Follows chats/{chatId} for the things that are different for each of the two people: who blocked whom,
 * and where this user's history starts. One listener per open chat; the document is the same one the
 * unread-counter hook listens to, and Firestore serves both from one server watch.
 *
 * Everything is keyed by the chat it was read for, so after switching chats the previous chat's state can
 * never be taken for the new one, not even for a single render.
 */
export function useConversationState(
    chatId: string | null,
    userId: string | undefined,
    otherId: string | null
): ConversationStateHandle {
    const [remote, setRemote] = useState<Remote | null>(null);
    const [local, setLocal] = useState<Local | null>(null);

    useEffect(() => {
        if (!chatId || !userId) return;

        const publish = (snapshot: { get: (field: string) => unknown } | null) => {
            const blocks = getBlockStatus(snapshot?.get("blocks"), userId, otherId);
            setRemote({
                chatId,
                clearedAt: getUserTime(snapshot?.get("clearedAt"), userId),
                blockedByMe: blocks.byMe,
                blockedByOther: blocks.byOther,
            });
            // The server has spoken: whatever was assumed locally is now confirmed or superseded.
            setLocal(null);
        };

        return onSnapshot(
            doc(firebaseClientDB, "chats", chatId),
            (snapshot) => publish(snapshot),
            (error) => {
                console.error("Error listening to the conversation state: ", error);
                // Don't hold the conversation hostage to a failed listener: show it as if nothing was cleared or blocked.
                // (The server still refuses a send to a blocked chat, and says why.)
                publish(null);
            }
        );
    }, [chatId, userId, otherId]);

    const applyLocal = useCallback(
        (change: LocalConversationChange) => {
            if (chatId) setLocal({ chatId, ...change });
        },
        [chatId]
    );

    return useMemo(() => {
        const current = remote && remote.chatId === chatId ? remote : null;
        if (!current) return { ...NOT_READY, applyLocal };

        const assumed = local && local.chatId === chatId ? local : null;
        const blockedByMe = assumed?.blockedByMe ?? current.blockedByMe;
        return {
            ready: true,
            // Clearing only ever moves forward: an assumed value can raise the marker, never lower it.
            clearedAt: laterOf(current.clearedAt, assumed?.clearedAt),
            blockedByMe,
            blockedByOther: current.blockedByOther,
            blocked: blockedByMe || current.blockedByOther,
            applyLocal,
        };
    }, [remote, local, chatId, applyLocal]);
}
