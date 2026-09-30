"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useOptimistic, useTransition } from "react";
import {
    ContactStatus,
    MAX_KEYWORD_LENGTH,
    hasActiveContactFilters,
    parseContactQuery,
} from "./contactUtils";

/**
 * The only place that writes the Contact page's URL.
 *
 * - Every write starts from the current URL, so unrelated params survive and
 *   each setter / clearer touches only its own key.
 * - Changing keyword or status resets `page` (page 4 of an old result set is
 *   meaningless for a new one).
 * - Navigation runs in a transition so the UI can show `isPending` while the
 *   server re-renders, and the status tabs can update instantly.
 */
export function useContactQuery() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const query = useMemo(() => parseContactQuery(searchParams), [searchParams]);
    const [status, setOptimisticStatus] = useOptimistic(query.status);

    const commit = useCallback(
        (mutate: (params: URLSearchParams) => void, optimistic?: () => void) => {
            const params = new URLSearchParams(searchParams.toString());
            mutate(params);
            params.delete("page");

            const qs = params.toString();
            startTransition(() => {
                optimistic?.();
                router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
            });
        },
        [pathname, router, searchParams],
    );

    const setKeyword = useCallback(
        (value: string) => {
            const next = value.trim().slice(0, MAX_KEYWORD_LENGTH);
            if (next === query.keyword) return;
            commit((params) => (next ? params.set("keyword", next) : params.delete("keyword")));
        },
        [commit, query.keyword],
    );

    const setStatus = useCallback(
        (value: ContactStatus | null) => {
            if (value === query.status) return;
            commit(
                (params) => (value ? params.set("status", value) : params.delete("status")),
                () => setOptimisticStatus(value),
            );
        },
        [commit, query.status, setOptimisticStatus],
    );

    const clearKeyword = useCallback(() => setKeyword(""), [setKeyword]);
    const clearStatus = useCallback(() => setStatus(null), [setStatus]);

    const clearAll = useCallback(
        () =>
            commit(
                (params) => {
                    params.delete("keyword");
                    params.delete("status");
                },
                () => setOptimisticStatus(null),
            ),
        [commit, setOptimisticStatus],
    );

    return {
        query,
        /** Status as the user just picked it (updates before the server answers). */
        status,
        isPending,
        hasActiveFilters: hasActiveContactFilters(query),
        setKeyword,
        setStatus,
        clearKeyword,
        clearStatus,
        clearAll,
    };
}

export type ContactQueryApi = ReturnType<typeof useContactQuery>;
