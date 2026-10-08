"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { COMMENT_ADMIN_PAGE_SIZE } from "@/components/blog/lib/constants";
import type { CommentAdminList, CommentAdminQuery, CommentStatusFilter } from "@/components/blog/lib/comment-types";
import { fetchCommentList, isAborted, toApiFailure } from "../lib/commentsApi";

interface ListState {
    /** The request this state answers. While it differs from the current request, we're loading. */
    key: string;
    list: CommentAdminList | null;
    error: string | null;
}

/** Opens on "Pending": the moderation inbox is what an admin comes here for. */
const INITIAL_QUERY: CommentAdminQuery = { page: 1, pageSize: COMMENT_ADMIN_PAGE_SIZE, search: "", status: "pending", blogId: "" };

/**
 * The moderation list's data: the status tab, debounced search and the request that follows them.
 * The previous page stays on screen while the next one loads, so the list never flashes empty.
 */
export function useCommentList() {
    const [query, setQuery] = useState<CommentAdminQuery>(INITIAL_QUERY);
    const [searchInput, setSearchInput] = useState("");
    const [reloadToken, setReloadToken] = useState(0);
    const [state, setState] = useState<ListState>({ key: "", list: null, error: null });

    useEffect(() => {
        const timer = setTimeout(() => {
            setQuery((current) => (current.search === searchInput ? current : { ...current, search: searchInput, page: 1 }));
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const requestKey = useMemo(() => JSON.stringify([query, reloadToken]), [query, reloadToken]);

    useEffect(() => {
        const controller = new AbortController();
        fetchCommentList(query, controller.signal)
            .then((list) => setState({ key: requestKey, list, error: null }))
            .catch((error) => {
                if (isAborted(error)) return;
                setState((previous) => ({ key: requestKey, list: previous.list, error: toApiFailure(error).message }));
            });
        return () => controller.abort();
        // `query` is covered by `requestKey`.
    }, [requestKey]);

    const setStatus = useCallback((status: CommentStatusFilter) => setQuery((current) => ({ ...current, status, page: 1 })), []);
    const setPage = useCallback((page: number) => setQuery((current) => ({ ...current, page })), []);
    const reload = useCallback(() => setReloadToken((token) => token + 1), []);

    return {
        query,
        searchInput,
        setSearchInput,
        setStatus,
        setPage,
        reload,
        list: state.list,
        error: state.error,
        isLoading: state.key !== requestKey,
    };
}
