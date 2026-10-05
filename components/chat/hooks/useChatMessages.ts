"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
    collection,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    startAfter,
    startAt,
    type CollectionReference,
    type DocumentData,
    type QueryDocumentSnapshot,
    type Unsubscribe,
} from "firebase/firestore";
import { firebaseClientDB } from "@/lib/config/firebase-client";
import { MESSAGES_PAGE_SIZE } from "../lib/constants";
import { mapMessageDoc } from "../lib/mapMessage";
import type { MessageType } from "../types";

type MessageDoc = QueryDocumentSnapshot<DocumentData>;
type MessagesRef = CollectionReference<DocumentData>;

/** Everything that belongs to the chat currently open. A new one replaces it (and the old one is torn down) on chat change. */
interface Session {
    messagesRef: MessagesRef;
    userId: string;
    cancelled: boolean;
    /** The oldest message loaded so far: the next page starts right before it. */
    cursor: MessageDoc | null;
    hasMore: boolean;
    loadingMore: boolean;
    /** Older pages loaded so far; the next one gets this index. */
    pagesLoaded: number;
    unsubscribers: Unsubscribe[];
}

const toMessages = (docs: readonly MessageDoc[], userId: string): MessageType[] =>
    docs.map((docSnap) => mapMessageDoc(docSnap.id, docSnap.data(), userId));

/** Older pages are queried newest-first; the UI wants them oldest-first. */
const oldestFirst = (docs: readonly MessageDoc[]): MessageDoc[] => [...docs].reverse();

const withPage = (pages: MessageType[][], index: number, page: MessageType[]): MessageType[][] => {
    const next = pages.slice();
    next[index] = page;
    return next;
};

/**
 * Whether anything is older than `cursor`. Costs one document read, and spares the reader a
 * "Load more" button that would come back empty when the history is an exact multiple of the page size.
 */
async function hasOlderMessages(messagesRef: MessagesRef, cursor: MessageDoc): Promise<boolean> {
    const probe = await getDocs(query(messagesRef, orderBy("time", "desc"), startAfter(cursor), limit(1)));
    return !probe.empty;
}

/**
 * The messages of one chat, loaded a page at a time and kept live.
 *
 * The conversation is split into ranges that never overlap, each with its own listener:
 *  - the live tail: everything from the newest page's oldest message onwards, with no upper limit,
 *    so new messages arrive in it and it never "slides" the way a `limit(n)` window would;
 *  - one older page per `loadMore()`: the 15 messages right before the oldest one loaded so far.
 *
 * So an edit, deletion or reaction on ANY loaded message reaches both users in real time, and each
 * `loadMore()` reads only the next 15 messages instead of re-reading everything already on screen.
 * `messages` is always in chronological order (oldest first).
 */
export function useChatMessages(chatId: string | null, currentUserId: string | undefined) {
    const [latest, setLatest] = useState<MessageType[]>([]);
    /** olderPages[0] sits right before `latest`; the last entry is the furthest back in time. Each page is oldest-first. */
    const [olderPages, setOlderPages] = useState<MessageType[][]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);
    const [hasMore, setHasMore] = useState<boolean>(false);
    const sessionRef = useRef<Session | null>(null);

    useEffect(() => {
        if (!chatId || !currentUserId) return;

        const session: Session = {
            messagesRef: collection(firebaseClientDB, "chats", chatId, "messages"),
            userId: currentUserId,
            cancelled: false,
            cursor: null,
            hasMore: false,
            loadingMore: false,
            pagesLoaded: 0,
            unsubscribers: [],
        };
        sessionRef.current = session;

        setLoading(true);
        setLatest([]);
        setOlderPages([]);
        setHasMore(false);
        setLoadingMore(false);

        const open = async () => {
            try {
                // The newest page, fetched once: its oldest message is where the live listener starts.
                const newest = await getDocs(
                    query(session.messagesRef, orderBy("time", "desc"), limit(MESSAGES_PAGE_SIZE))
                );
                if (session.cancelled) return;

                const cursor = newest.docs[newest.docs.length - 1] ?? null;
                const more =
                    cursor !== null &&
                    newest.size === MESSAGES_PAGE_SIZE &&
                    (await hasOlderMessages(session.messagesRef, cursor));
                if (session.cancelled) return;

                session.cursor = cursor;
                session.hasMore = more;
                setLatest(toMessages(oldestFirst(newest.docs), session.userId));
                setHasMore(more);
                setLoading(false);

                // From that message on, everything stays live: edits, deletions and reactions arrive
                // here too, so both users see them in real time, and so do new messages.
                const liveQuery = cursor
                    ? query(session.messagesRef, orderBy("time", "asc"), startAt(cursor))
                    : query(session.messagesRef, orderBy("time", "asc"));
                session.unsubscribers.push(
                    onSnapshot(
                        liveQuery,
                        (snapshot) => {
                            if (!session.cancelled) setLatest(toMessages(snapshot.docs, session.userId));
                        },
                        (error) => console.error("Error fetching realtime messages: ", error)
                    )
                );
            } catch (error) {
                console.error("Error fetching realtime messages: ", error);
                if (!session.cancelled) setLoading(false);
            }
        };
        void open();

        return () => {
            session.cancelled = true;
            session.unsubscribers.forEach((unsubscribe) => unsubscribe());
            if (sessionRef.current === session) sessionRef.current = null;
        };
    }, [chatId, currentUserId]);

    /**
     * Loads the 15 messages before the oldest one on screen and keeps them live.
     * Resolves to true when a page was added, false when nothing was (nothing older, a failure,
     * or a load already in progress).
     */
    const loadMore = useCallback(async (): Promise<boolean> => {
        const session = sessionRef.current;
        if (!session || !session.cursor || !session.hasMore || session.loadingMore) return false;

        session.loadingMore = true;
        setLoadingMore(true);

        const pageIndex = session.pagesLoaded;
        // `docs` is the page as of the latest snapshot. `onScreen` flips once the page has been added to the
        // state: from then on every further snapshot of this page (edit, deletion, reaction) updates it.
        const page: { docs: MessageDoc[] | null; onScreen: boolean } = { docs: null, onScreen: false };
        let unsubscribe: Unsubscribe | undefined;

        try {
            let firstAnswer!: () => void;
            let firstFailure!: (error: unknown) => void;
            const answered = new Promise<void>((resolve, reject) => {
                firstAnswer = resolve;
                firstFailure = reject;
            });

            unsubscribe = onSnapshot(
                query(
                    session.messagesRef,
                    orderBy("time", "desc"),
                    startAfter(session.cursor),
                    limit(MESSAGES_PAGE_SIZE)
                ),
                (snapshot) => {
                    if (session.cancelled) return;
                    const isFirst = page.docs === null;
                    // The first answer has to come from the server: a snapshot built only from the local
                    // cache could be an incomplete page, and the cursor and "has more" are derived from it.
                    if (isFirst && snapshot.metadata.fromCache) return;

                    page.docs = snapshot.docs;
                    if (isFirst) firstAnswer();
                    else if (page.onScreen) {
                        setOlderPages((pages) =>
                            withPage(pages, pageIndex, toMessages(oldestFirst(snapshot.docs), session.userId))
                        );
                    }
                },
                (error) => {
                    if (page.docs === null) firstFailure(error);
                    else console.error("Error listening to older messages: ", error);
                }
            );
            session.unsubscribers.push(unsubscribe);

            await answered;
            if (session.cancelled) return false;

            const first = page.docs ?? [];
            if (first.length === 0) {
                // Nothing there after all: there is no older history.
                unsubscribe();
                session.hasMore = false;
                setHasMore(false);
                return false;
            }

            const more =
                first.length === MESSAGES_PAGE_SIZE &&
                (await hasOlderMessages(session.messagesRef, first[first.length - 1]));
            if (session.cancelled) return false;

            // Commit in one go (one render): the page, whether more remains, and the next cursor.
            // `page.docs` is re-read because the page may have changed while the check above ran.
            const docs = page.docs ?? first;
            session.cursor = docs[docs.length - 1] ?? first[first.length - 1];
            session.hasMore = more;
            session.pagesLoaded = pageIndex + 1;
            page.onScreen = true;
            setOlderPages((pages) => withPage(pages, pageIndex, toMessages(oldestFirst(docs), session.userId)));
            setHasMore(more);
            return true;
        } catch (error) {
            console.error("Error loading older messages: ", error);
            unsubscribe?.();
            if (!session.cancelled) {
                toast.error("Couldn't load older messages. Please try again.", { id: "chat-load-older-error" });
            }
            return false;
        } finally {
            session.loadingMore = false;
            if (!session.cancelled) setLoadingMore(false);
        }
    }, []);

    // Oldest page first, then the live tail. Every range is already sorted, so no sorting is needed.
    const messages = useMemo(() => {
        const chronological = [...olderPages].reverse().flat().concat(latest);
        // The ranges can't overlap, but a duplicate id would break React keys, so never let one through.
        const seen = new Set<string>();
        return chronological.filter((message) => {
            if (seen.has(message.id)) return false;
            seen.add(message.id);
            return true;
        });
    }, [olderPages, latest]);

    return { messages, loading, hasMore, loadingMore, loadMore };
}
