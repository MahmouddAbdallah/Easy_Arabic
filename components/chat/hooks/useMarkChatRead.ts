"use client";

import { useEffect } from "react";
import axios from "axios";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseClientDB } from "@/lib/config/firebase-client";
import { MESSAGES_API_URL } from "../lib/constants";
import { getUnreadCount } from "../lib/unread";

/**
 * Clears the current user's unread counter while they are looking at a chat: when it is opened, and
 * again whenever something new for them arrives (a message or a reaction) while it stays open.
 * While the tab is hidden nothing is cleared; it happens as soon as the tab is visible again.
 *
 * It follows the chat document itself, so a failed request is simply retried on the next change of the
 * document (or when the tab becomes visible) and needs no retry logic of its own.
 */
export function useMarkChatRead(chatId: string | null, userId: string | undefined) {
    useEffect(() => {
        if (!chatId || !userId) return;

        let unread = 0; // the latest count seen on the chat document
        let running = false; // a request is in flight
        let again = false; // the document changed while it was
        let cancelled = false;

        const markRead = async () => {
            if (running) {
                again = true;
                return;
            }
            if (unread === 0 || document.visibilityState !== "visible") return;

            running = true;
            try {
                await axios.patch(MESSAGES_API_URL, { action: "markRead", chatId });
            } catch (error) {
                console.error("Failed to mark the chat as read:", error);
            } finally {
                running = false;
                if (again && !cancelled) {
                    again = false;
                    void markRead();
                }
            }
        };

        const unsubscribe = onSnapshot(
            doc(firebaseClientDB, "chats", chatId),
            (snapshot) => {
                unread = getUnreadCount(snapshot.get("unreadCount"), userId);
                void markRead();
            },
            (error) => console.error("Error listening to the chat for unread counts: ", error)
        );

        const onVisibilityChange = () => void markRead();
        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            cancelled = true;
            unsubscribe();
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [chatId, userId]);
}
