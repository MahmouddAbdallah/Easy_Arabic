"use client";

import { useCallback, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { MESSAGES_API_URL } from "../lib/constants";
import type { ReactionKey } from "../lib/reactions";

type ActionPayload =
    | { action: "edit"; text: string }
    | { action: "delete" }
    | { action: "react"; reaction: ReactionKey | null };

function getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error?.message;
        if (typeof message === "string" && message) return message;
        if (!error.response) return "Network error. Please check your connection and try again.";
    }
    return "Something went wrong. Please try again.";
}

/**
 * Edit / delete / react calls for the messages of one chat.
 *
 * - One request per message at a time: a synchronous ref guards against double clicks
 *   (state alone would still allow two calls in the same tick).
 * - No optimistic UI: the Firestore listener delivers the change to both users, so the
 *   UI never shows something the server hasn't accepted.
 */
export function useMessageActions(chatId: string | null) {
    const inFlight = useRef(new Set<string>());
    const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());

    const run = useCallback(
        async (messageId: string, payload: ActionPayload): Promise<boolean> => {
            if (!chatId || inFlight.current.has(messageId)) return false;

            inFlight.current.add(messageId);
            setPendingIds(new Set(inFlight.current));

            try {
                await axios.patch(MESSAGES_API_URL, { ...payload, chatId, messageId });
                return true;
            } catch (error) {
                toast.error(getErrorMessage(error), { id: "chat-message-action-error" });
                return false;
            } finally {
                inFlight.current.delete(messageId);
                setPendingIds(new Set(inFlight.current));
            }
        },
        [chatId]
    );

    const editMessage = useCallback(
        (messageId: string, text: string) => run(messageId, { action: "edit", text }),
        [run]
    );
    const deleteMessage = useCallback(
        (messageId: string) => run(messageId, { action: "delete" }),
        [run]
    );
    /** Pass the desired reaction; null removes the current user's reaction. */
    const reactToMessage = useCallback(
        (messageId: string, reaction: ReactionKey | null) => run(messageId, { action: "react", reaction }),
        [run]
    );
    const isPending = useCallback((messageId: string) => pendingIds.has(messageId), [pendingIds]);

    return { editMessage, deleteMessage, reactToMessage, isPending };
}
