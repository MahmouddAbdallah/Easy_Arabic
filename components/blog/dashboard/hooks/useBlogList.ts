"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ADMIN_PAGE_SIZE } from "@/components/blog/lib/constants";
import type { BlogAdminList, BlogAdminQuery, BlogStatusFilter } from "@/components/blog/lib/types";
import { fetchBlogList, isAborted, toApiFailure } from "../lib/blogApi";

interface ListState {
    /** The request this state answers. While it differs from the current request, we're loading. */
    key: string;
    list: BlogAdminList | null;
    error: string | null;
}

const INITIAL_QUERY: BlogAdminQuery = { page: 1, pageSize: ADMIN_PAGE_SIZE, search: "", status: "all", category: "" };

/**
 * The dashboard table's data: filters, debounced search, and the request that follows them.
 * The previous page stays on screen while the next one loads, so the table never flashes empty.
 */
export function useBlogList() {
    const [query, setQuery] = useState<BlogAdminQuery>(INITIAL_QUERY);
    const [searchInput, setSearchInput] = useState("");
    const [reloadToken, setReloadToken] = useState(0);
    const [state, setState] = useState<ListState>({ key: "", list: null, error: null });

    // Search waits for a pause in typing, then restarts from page 1.
    useEffect(() => {
        const timer = setTimeout(() => {
            setQuery((current) => (current.search === searchInput ? current : { ...current, search: searchInput, page: 1 }));
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const requestKey = useMemo(() => JSON.stringify([query, reloadToken]), [query, reloadToken]);

    useEffect(() => {
        const controller = new AbortController();
        fetchBlogList(query, controller.signal)
            .then((list) => setState({ key: requestKey, list, error: null }))
            .catch((error) => {
                if (isAborted(error)) return;
                setState((previous) => ({ key: requestKey, list: previous.list, error: toApiFailure(error).message }));
            });
        return () => controller.abort();
        // `query` is covered by `requestKey`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestKey]);

    const setStatus = useCallback((status: BlogStatusFilter) => setQuery((current) => ({ ...current, status, page: 1 })), []);
    const setCategory = useCallback((category: string) => setQuery((current) => ({ ...current, category, page: 1 })), []);
    const setPage = useCallback((page: number) => setQuery((current) => ({ ...current, page })), []);
    const reload = useCallback(() => setReloadToken((token) => token + 1), []);

    return {
        query,
        searchInput,
        setSearchInput,
        setStatus,
        setCategory,
        setPage,
        reload,
        list: state.list,
        error: state.error,
        isLoading: state.key !== requestKey,
    };
}
