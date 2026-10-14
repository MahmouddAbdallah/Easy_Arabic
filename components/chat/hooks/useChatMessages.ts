"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { CHAT_LOAD_ERROR_TOAST_ID, MESSAGES_PAGE_SIZE } from "../lib/constants";
import { mapMessageDoc } from "../lib/mapMessage";
import { createFirestoreMessageSource, type FirestoreHandle } from "../lib/messageSource";
import { MessageStore, type ChatLoadError, type MessageKey, type MessagesSnapshot, type RevealResult } from "../lib/messageStore";
import type { MessageType } from "../types";

export type ChatMessages = MessagesSnapshot<MessageType>;

const EMPTY: ChatMessages = {
    messages: [],
    loading: true,
    failed: false,
    hasOlder: false,
    hasNewer: false,
    loadingOlder: false,
    loadingNewer: false,
    revealing: false,
    detached: false,
    latest: null,
};

function reportError(error: ChatLoadError): void {
    console.error("Chat messages:", error.code, error.cause ?? "");
    toast.error(
        error.code === "timeout"
            ? "Taking too long to load messages. Check your connection and try again."
            : "Couldn't load messages. Please try again.",
        { id: CHAT_LOAD_ERROR_TOAST_ID }
    );
}

interface Options {
    /** The conversation is known to exist for this user; nothing is read before that. */
    enabled: boolean;
    /** The user's own "clear chat" marker: messages sent at or before it are not theirs to see any more. */
    clearedAt: string | null;
}

/**
 * The messages of one conversation as the UI needs them. All of the loading, paging and jumping rules live in
 * `MessageStore`; this hook only wires it to Firestore, to React and to the user's feedback.
 */
export function useChatMessages(
    chatId: string | null | undefined,
    currentUserId: string | null | undefined,
    { enabled, clearedAt }: Options
) {
    // The state remembers which chat it belongs to, so a different chat never shows the previous one's messages
    // for even a frame.
    const [state, setState] = useState<{ chatId: string | null; snapshot: ChatMessages }>({ chatId: null, snapshot: EMPTY });
    const currentChat = chatId ?? null;
    const storeRef = useRef<MessageStore<FirestoreHandle, MessageType> | null>(null);
    /** The chat whose messages were last shown: a change of `clearedAt` inside the same chat must not flash a loader. */
    const shownChatRef = useRef<string | null>(null);

    useEffect(() => {
        if (!chatId || !currentUserId || !enabled) return;

        const store = new MessageStore<FirestoreHandle, MessageType>({
            source: createFirestoreMessageSource(chatId, clearedAt),
            toMessage: (doc) => mapMessageDoc(doc.id, doc.data, currentUserId),
            pageSize: MESSAGES_PAGE_SIZE,
            onError: reportError,
        });
        storeRef.current = store;

        const keepScreen = shownChatRef.current === chatId;
        const unsubscribe = store.subscribe((snapshot) => {
            if (snapshot.loading && keepScreen && snapshot.messages.length === 0) {
                setState({ chatId, snapshot: { ...snapshot, loading: false } });
                return;
            }
            setState({ chatId, snapshot });
        });
        shownChatRef.current = chatId;
        void store.start();

        return () => {
            unsubscribe();
            store.dispose();
            if (storeRef.current === store) storeRef.current = null;
        };
    }, [chatId, currentUserId, enabled, clearedAt]);

    const snapshot = currentChat !== null && state.chatId === currentChat ? state.snapshot : EMPTY;

    const loadOlder = useCallback(() => storeRef.current?.loadOlder() ?? Promise.resolve(false), []);
    const loadNewer = useCallback(() => storeRef.current?.loadNewer() ?? Promise.resolve(false), []);
    const reveal = useCallback(
        (target: MessageKey): Promise<RevealResult> => storeRef.current?.reveal(target) ?? Promise.resolve("failed"),
        []
    );
    const returnToLatest = useCallback(() => storeRef.current?.returnToLatest(), []);
    const reload = useCallback(() => storeRef.current?.reload() ?? Promise.resolve(), []);

    return { ...snapshot, loadOlder, loadNewer, reveal, returnToLatest, reload };
}
