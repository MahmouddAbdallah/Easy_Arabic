"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { getErrorMessage } from "../lib/getErrorMessage";
import {
    CHAT_SEARCH_API_URL,
    CHAT_SEARCH_DEBOUNCE_MS,
    CHAT_SEARCH_PAGE_SIZE,
    parseSearchQuery,
    type ChatSearchResponse,
    type ChatSearchResult,
} from "../lib/chatSearch";

/**
 * Requests chained back to back, without being asked, while a response found nothing but there is still
 * older history to look through. Each one reads a bounded slice (see chatSearch.server.ts), so this caps
 * what one keystroke can cost; after that the reader chooses whether to keep looking.
 */
const MAX_CHAINED_REQUESTS = 4;

export type ChatSearchStatus = "idle" | "loading" | "ready" | "error";

interface SearchState {
    status: ChatSearchStatus;
    /** Newest first. */
    results: ChatSearchResult[];
    /** Where the next (older) results start; null when the whole history has been searched. */
    nextCursor: string | null;
    /** Messages looked through so far for this query. */
    scanned: number;
    /** Older results are being fetched (the ones already shown stay). */
    loadingMore: boolean;
    error: string | null;
    /** The query these results belong to, as sent to the server. */
    searchedQuery: string;
    /** Its words in comparable form: what the message bubbles highlight. */
    terms: readonly string[];
    /** The result the reader is on. */
    activeId: string | null;
    /** The last response filled a whole page, so scrolling to its end is worth more results. */
    pageFull: boolean;
}

const NO_TERMS: readonly string[] = [];

const IDLE: SearchState = {
    status: "idle",
    results: [],
    nextCursor: null,
    scanned: 0,
    loadingMore: false,
    error: null,
    searchedQuery: "",
    terms: NO_TERMS,
    activeId: null,
    pageFull: false,
};

interface Collected {
    results: ChatSearchResult[];
    nextCursor: string | null;
    scanned: number;
    pageFull: boolean;
}

/**
 * One "page" of results: asks the server, and while it has found nothing but says there is more history,
 * asks again (up to MAX_CHAINED_REQUESTS). `onProgress` reports how far the search has got meanwhile.
 */
async function collect(
    receiverId: string,
    query: string,
    from: string | null,
    signal: AbortSignal,
    onProgress: (scanned: number) => void
): Promise<Collected> {
    const results: ChatSearchResult[] = [];
    let cursor = from;
    let scanned = 0;
    let pageFull = false;

    for (let request = 0; request < MAX_CHAINED_REQUESTS; request++) {
        const { data } = await axios.get<ChatSearchResponse>(CHAT_SEARCH_API_URL, {
            params: { receiverId, q: query, ...(cursor ? { cursor } : {}) },
            signal,
        });
        if (!data || !Array.isArray(data.results)) throw new Error("Unexpected search response");

        results.push(...data.results);
        scanned += data.scanned;
        cursor = data.nextCursor;
        pageFull = data.results.length >= CHAT_SEARCH_PAGE_SIZE;

        if (results.length > 0 || !cursor) break;
        onProgress(scanned);
    }

    return { results, nextCursor: cursor, scanned, pageFull };
}

interface UseChatSearchOptions {
    chatId: string | null;
    receiverId: string | null;
    /** The search is open. Closing it cancels everything and forgets the query and the results. */
    enabled: boolean;
}

/**
 * Searching the whole history of the open chat.
 *
 *  - Debounced: a request goes out CHAT_SEARCH_DEBOUNCE_MS after the last keystroke, never one per key.
 *  - A newer query cancels the older request, and a response that arrives late is never shown.
 *  - Results are newest first and pageable: `loadMore()` continues where the last response stopped, so the
 *    history is only read as far as the reader actually goes.
 *  - `step()` moves between results (loading more when it runs off the end), `select()` picks one.
 */
export function useChatSearch({ chatId, receiverId, enabled }: UseChatSearchOptions) {
    const [query, setQuery] = useState("");
    const [state, setState] = useState<SearchState>(IDLE);
    const stateRef = useRef<SearchState>(IDLE);
    /** Belongs to the current query: aborted as soon as the query (or the chat) changes. */
    const controllerRef = useRef<AbortController | null>(null);
    /** A retry should not wait for the typing pause. */
    const skipDebounceRef = useRef(false);
    const [attempt, setAttempt] = useState(0);

    const commit = useCallback((next: SearchState | ((previous: SearchState) => SearchState)) => {
        const value = typeof next === "function" ? next(stateRef.current) : next;
        stateRef.current = value;
        setState(value);
    }, []);

    // Closing the search forgets the query, so reopening starts from a clean slate.
    useEffect(() => {
        if (!enabled) setQuery("");
    }, [enabled]);

    useEffect(() => {
        controllerRef.current?.abort();
        controllerRef.current = null;

        const searched = query.trim();
        const terms = parseSearchQuery(searched);
        if (!enabled || !chatId || !receiverId || terms.length === 0) {
            commit(IDLE);
            return;
        }

        // Typing again clears any error and shows that something is happening, but keeps the previous
        // results on screen (dimmed) until the new ones arrive, so the list doesn't flash empty.
        commit((previous) => ({ ...previous, status: "loading", error: null, loadingMore: false }));

        const controller = new AbortController();
        controllerRef.current = controller;

        const run = async () => {
            try {
                const found = await collect(receiverId, searched, null, controller.signal, (scanned) =>
                    commit((previous) => ({ ...previous, scanned }))
                );
                if (controller.signal.aborted) return;

                commit({
                    status: "ready",
                    results: found.results,
                    nextCursor: found.nextCursor,
                    scanned: found.scanned,
                    loadingMore: false,
                    error: null,
                    searchedQuery: searched,
                    terms,
                    activeId: null,
                    pageFull: found.pageFull,
                });
            } catch (error) {
                if (controller.signal.aborted || axios.isCancel(error)) return;
                console.error("Error searching the chat:", error);
                commit((previous) => ({ ...previous, status: "error", error: getErrorMessage(error), loadingMore: false }));
            }
        };

        const delay = skipDebounceRef.current ? 0 : CHAT_SEARCH_DEBOUNCE_MS;
        skipDebounceRef.current = false;
        const timer = setTimeout(() => void run(), delay);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query, enabled, chatId, receiverId, attempt, commit]);

    /** Older results, after the ones shown. Resolves when done (also when there was nothing to do). */
    const loadMore = useCallback(async (): Promise<void> => {
        const current = stateRef.current;
        const controller = controllerRef.current;
        if (!receiverId || !controller || controller.signal.aborted) return;
        if (current.status !== "ready" || !current.nextCursor || current.loadingMore) return;

        commit((previous) => ({ ...previous, loadingMore: true, error: null }));
        try {
            const found = await collect(receiverId, current.searchedQuery, current.nextCursor, controller.signal, (scanned) =>
                commit((previous) => ({ ...previous, scanned: current.scanned + scanned }))
            );
            if (controller.signal.aborted) return;

            commit((previous) => {
                const known = new Set(previous.results.map((result) => result.id));
                return {
                    ...previous,
                    results: [...previous.results, ...found.results.filter((result) => !known.has(result.id))],
                    nextCursor: found.nextCursor,
                    scanned: current.scanned + found.scanned,
                    loadingMore: false,
                    pageFull: found.pageFull,
                };
            });
        } catch (error) {
            if (controller.signal.aborted || axios.isCancel(error)) return;
            console.error("Error loading more search results:", error);
            // The results already shown stay; the footer offers a retry.
            commit((previous) => ({ ...previous, loadingMore: false, error: getErrorMessage(error) }));
        }
    }, [receiverId, commit]);

    /** Starts the search again right away (after a failure). */
    const retry = useCallback(() => {
        skipDebounceRef.current = true;
        setAttempt((value) => value + 1);
    }, []);

    const select = useCallback(
        (id: string) => commit((previous) => ({ ...previous, activeId: id })),
        [commit]
    );

    /**
     * Moves to the next result: "older" goes down the list (and fetches more when it runs out), "newer" goes
     * back up. Resolves to the result now selected, or null when there is nowhere to go.
     */
    const step = useCallback(
        async (direction: "older" | "newer"): Promise<ChatSearchResult | null> => {
            const { status, results, activeId, nextCursor } = stateRef.current;
            if (status !== "ready" || results.length === 0) return null;

            const index = activeId ? results.findIndex((result) => result.id === activeId) : -1;
            let target: ChatSearchResult | undefined;

            if (direction === "newer") {
                target = index === -1 ? results[0] : results[index - 1];
            } else {
                target = results[index + 1];
                if (!target && nextCursor) {
                    await loadMore();
                    target = stateRef.current.results[index + 1];
                }
            }

            if (!target) return null;
            select(target.id);
            return target;
        },
        [loadMore, select]
    );

    const { results, activeId, nextCursor } = state;
    const activeIndex = useMemo(
        () => (activeId ? results.findIndex((result) => result.id === activeId) : -1),
        [results, activeId]
    );

    return {
        /** What the input shows. */
        query,
        setQuery,
        status: state.status,
        results,
        error: state.error,
        loadingMore: state.loadingMore,
        /** Messages looked through so far. */
        scanned: state.scanned,
        /** The query the shown results belong to (the typed one can be ahead of it by a moment). */
        searchedQuery: state.searchedQuery,
        /** Comparable words of that query, for highlighting inside the conversation. */
        terms: state.terms,
        activeId,
        activeIndex,
        /** Older history has not been searched yet. */
        hasMore: nextCursor !== null,
        pageFull: state.pageFull,
        /** One step further is possible in each direction. */
        canGoOlder: activeIndex === -1 ? results.length > 0 : activeIndex + 1 < results.length || nextCursor !== null,
        canGoNewer: activeIndex > 0,
        loadMore,
        retry,
        select,
        step,
    };
}

export type ChatSearchController = ReturnType<typeof useChatSearch>;
