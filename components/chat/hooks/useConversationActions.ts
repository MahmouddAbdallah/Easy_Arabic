"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { CONVERSATIONS_API_URL } from "../lib/constants";
import type { ConversationAction, ConversationResponse } from "../lib/conversationSchemas";
import { getErrorMessage } from "../lib/getErrorMessage";
import type { ConversationStateHandle } from "./useConversationState";

export type ConversationActionName = ConversationAction;

export interface ConversationActions {
    /** The action running for the open chat, or null. */
    pending: ConversationActionName | null;
    /** Some action is running for the open chat: every other one waits. */
    busy: boolean;
    /** Each resolves to true when the server accepted it (a failure has already been shown to the user). */
    block: () => Promise<boolean>;
    unblock: () => Promise<boolean>;
    /** `upTo`: ISO time of the newest message the user could see; later ones are left alone. */
    clear: (upTo?: string | null) => Promise<boolean>;
    remove: (upTo?: string | null) => Promise<boolean>;
}

interface Options {
    chatId: string | null;
    receiverId: string | null;
    /** Name used in the confirmation toasts. */
    receiverName?: string;
    conversation: Pick<ConversationStateHandle, "applyLocal">;
    /** The chat was deleted: take it out of the sidebar now. */
    onDeleted: (chatId: string, deletedAt: string) => void;
    /** The deleted chat is still the one on screen: leave it. */
    onLeave: () => void;
}

const ERROR_TOAST_ID = "chat-conversation-error";

/** What an action sends besides the receiver (which comes from the open chat, never from the caller). */
type ActionBody =
    | { action: "block" }
    | { action: "unblock" }
    | { action: "clear"; upTo?: string }
    | { action: "delete"; upTo?: string };

/**
 * Block / unblock / clear / delete for the open chat.
 *
 * - One request per chat at a time, guarded by a synchronous ref (a second click in the same tick, a second
 *   menu, the contact sheet and the dialog can't all start their own).
 * - No optimistic guess: the UI changes when the server has accepted the action, using the answer it gave
 *   (not a guess), so it can never show something the server refused. The Firestore listeners then confirm it.
 * - The result is applied to the chat that was open WHEN the action started: switching chats while a request
 *   is in flight can't clear, block or leave the wrong one.
 */
export function useConversationActions({
    chatId,
    receiverId,
    receiverName,
    conversation,
    onDeleted,
    onLeave,
}: Options): ConversationActions {
    const inFlight = useRef(new Map<string, ConversationActionName>());
    const [pendingByChat, setPendingByChat] = useState<Readonly<Record<string, ConversationActionName>>>({});

    // What the async code below must read at the moment the request ends, not when it started.
    const live = useRef({ chatId, conversation, onDeleted, onLeave });
    useEffect(() => {
        live.current = { chatId, conversation, onDeleted, onLeave };
    });

    const run = useCallback(
        async (body: ActionBody): Promise<boolean> => {
            if (!chatId || !receiverId || inFlight.current.has(chatId)) return false;

            const startedIn = chatId;
            inFlight.current.set(startedIn, body.action);
            setPendingByChat(Object.fromEntries(inFlight.current));

            try {
                const { data } = await axios.post<ConversationResponse>(CONVERSATIONS_API_URL, { ...body, receiverId });
                const stillOpen = live.current.chatId === startedIn;
                const name = receiverName ?? "this person";

                switch (body.action) {
                    case "block":
                        if (stillOpen) live.current.conversation.applyLocal({ blockedByMe: true });
                        toast.success(`${name} is blocked.`, { id: "chat-conversation-done" });
                        break;
                    case "unblock":
                        if (stillOpen) live.current.conversation.applyLocal({ blockedByMe: false });
                        toast.success(`${name} is unblocked.`, { id: "chat-conversation-done" });
                        break;
                    case "clear":
                        if (stillOpen && data.clearedAt) live.current.conversation.applyLocal({ clearedAt: data.clearedAt });
                        toast.success("Chat cleared.", { id: "chat-conversation-done" });
                        break;
                    case "delete":
                        if (data.deletedAt) live.current.onDeleted(startedIn, data.deletedAt);
                        if (stillOpen) live.current.onLeave();
                        toast.success("Chat deleted.", { id: "chat-conversation-done" });
                        break;
                }
                return true;
            } catch (error) {
                console.error(`Failed to ${body.action} the conversation:`, error);
                toast.error(getErrorMessage(error), { id: ERROR_TOAST_ID });
                return false;
            } finally {
                inFlight.current.delete(startedIn);
                setPendingByChat(Object.fromEntries(inFlight.current));
            }
        },
        [chatId, receiverId, receiverName]
    );

    const block = useCallback(() => run({ action: "block" }), [run]);
    const unblock = useCallback(() => run({ action: "unblock" }), [run]);
    const clear = useCallback((upTo?: string | null) => run({ action: "clear", ...(upTo && { upTo }) }), [run]);
    const remove = useCallback((upTo?: string | null) => run({ action: "delete", ...(upTo && { upTo }) }), [run]);

    const pending = (chatId && pendingByChat[chatId]) || null;
    return { pending, busy: pending !== null, block, unblock, clear, remove };
}
