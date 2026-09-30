"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    onDisconnect,
    onValue,
    ref,
    remove,
    serverTimestamp,
    set,
    type DatabaseReference,
} from "firebase/database";
import { firebaseClientDBRealTime } from "@/lib/config/firebase-client";

/**
 * Typing indicator on the existing Firebase Realtime Database (the same instance that holds the
 * online/offline status):
 *
 *   typing/{chatId}/{userId} = <server timestamp>      exists only while that user is typing
 *
 * Writer (useTypingIndicator): one write when typing starts, at most one refresh per
 * TYPING_HEARTBEAT_MS while the user keeps typing, one remove when they stop. Keystrokes themselves
 * never touch the network. Typing stops after TYPING_IDLE_MS without input, and immediately when the
 * input empties, the message is sent, the chat is left or the component unmounts.
 * `onDisconnect().remove()` covers closed tabs and lost connections.
 *
 * Reader (useTypingStatus): shows the indicator while the node exists, and drops it by itself when no
 * update arrives for TYPING_STALE_MS, so a writer that vanished without cleaning up can't leave it stuck.
 */
const TYPING_IDLE_MS = 1500;
const TYPING_HEARTBEAT_MS = 3000;
const TYPING_STALE_MS = 8000;

// Realtime Database keys can't contain . # $ [ ] or /. Ids in this app are uuids; anything else is not
// a chat we can address (and `ref()` would throw), so it is simply skipped.
const SAFE_KEY = /^[A-Za-z0-9_-]+$/;

function typingRef(chatId: string, userId: string): DatabaseReference | null {
    if (!SAFE_KEY.test(chatId) || !SAFE_KEY.test(userId)) return null;
    return ref(firebaseClientDBRealTime, `typing/${chatId}/${userId}`);
}

let errorReported = false;
/** Logged once: a missing Realtime Database rule would otherwise repeat the same warning on every write. */
function reportError(error: unknown) {
    if (errorReported) return;
    errorReported = true;
    console.warn("Typing indicator unavailable (check the Realtime Database rules for typing/):", error);
}

/**
 * Writer side. Call `notifyTyping()` whenever the input has text, `stopTyping()` when it is empty or
 * the message is sent. Both are stable, and leaving the chat / unmounting stops typing automatically.
 */
export function useTypingIndicator(chatId: string | null, userId: string | undefined) {
    // Where to write. A ref, so the returned callbacks keep their identity when the chat changes
    // (the caller's effects then don't re-run and can't mark "typing" in a chat nobody typed in).
    const target = useRef({ chatId, userId });
    // The node currently marked as "typing", or null.
    const active = useRef<{ chatId: string; node: DatabaseReference; lastWrite: number } | null>(null);
    const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        target.current = { chatId, userId };
    }, [chatId, userId]);

    const stopTyping = useCallback(() => {
        if (idleTimer.current) {
            clearTimeout(idleTimer.current);
            idleTimer.current = null;
        }
        const session = active.current;
        if (!session) return;
        active.current = null;
        remove(session.node).catch(reportError);
    }, []);

    const notifyTyping = useCallback(() => {
        const { chatId, userId } = target.current;
        if (!chatId || !userId) return;
        const node = typingRef(chatId, userId);
        if (!node) return;

        // Marked in another chat: close that one first.
        if (active.current && active.current.chatId !== chatId) stopTyping();

        const now = Date.now();
        if (!active.current) {
            active.current = { chatId, node, lastWrite: now };
            // Registered before the write, so a lost connection can never leave the node behind.
            onDisconnect(node).remove().catch(reportError);
            set(node, serverTimestamp()).catch(reportError);
        } else if (now - active.current.lastWrite >= TYPING_HEARTBEAT_MS) {
            // Keeps the reader's stale timer alive during long typing bursts.
            active.current.lastWrite = now;
            set(active.current.node, serverTimestamp()).catch(reportError);
        }

        if (idleTimer.current) clearTimeout(idleTimer.current);
        idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
    }, [stopTyping]);

    // Leaving the chat (or unmounting) never leaves the indicator behind.
    useEffect(() => stopTyping, [chatId, userId, stopTyping]);

    return { notifyTyping, stopTyping };
}

/** Reader side: is `otherUserId` typing in this chat right now? */
export function useTypingStatus(chatId: string | null, otherUserId: string | null | undefined): boolean {
    const key = chatId && otherUserId ? `${chatId}/${otherUserId}` : null;
    // The state remembers which chat it belongs to, so a value left over from another chat is never shown.
    const [state, setState] = useState<{ key: string | null; typing: boolean }>({ key: null, typing: false });

    useEffect(() => {
        if (!chatId || !otherUserId) return;
        const node = typingRef(chatId, otherUserId);
        if (!node) return;

        const currentKey = `${chatId}/${otherUserId}`;
        const show = (typing: boolean) =>
            setState((prev) =>
                prev.key === currentKey && prev.typing === typing ? prev : { key: currentKey, typing }
            );

        let staleTimer: ReturnType<typeof setTimeout> | undefined;

        const unsubscribe = onValue(
            node,
            (snapshot) => {
                clearTimeout(staleTimer);
                if (!snapshot.exists()) {
                    show(false);
                    return;
                }
                show(true);
                // Every refresh from the writer restarts this timer. If they stop refreshing without
                // removing the node (crash, dead connection), the indicator drops by itself.
                staleTimer = setTimeout(() => show(false), TYPING_STALE_MS);
            },
            (error) => {
                reportError(error);
                show(false);
            }
        );

        return () => {
            clearTimeout(staleTimer);
            unsubscribe();
            show(false);
        };
    }, [chatId, otherUserId]);

    return state.key === key && state.typing;
}
