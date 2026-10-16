"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { fetchGroupCandidates } from "../lib/groupApi";
import { getErrorMessage } from "../lib/getErrorMessage";
import type { GroupCandidate } from "../lib/groups";

/** How long the person has to stop typing before the list is asked for. */
const SEARCH_DELAY_MS = 300;

interface Loaded {
    /** What this answer is for: the search term and the retry it was asked under. */
    keyword: string;
    attempt: number;
    people: GroupCandidate[];
    hasMore: boolean;
    error: string | null;
}

export interface GroupCandidatesHandle {
    people: GroupCandidate[];
    hasMore: boolean;
    /** The very first list isn't here yet (there is nothing to show but a placeholder). */
    loading: boolean;
    /** A list is on its way (first load, a new search, or a retry); the previous one stays on screen meanwhile. */
    refreshing: boolean;
    error: string | null;
    retry: () => void;
}

/**
 * The people that can be added to a group, as the person types. Asking waits for a pause in the typing, an answer to
 * an older search is thrown away (it is cancelled, and ignored if it still arrives), and while a new list loads the
 * previous one stays put instead of flashing empty. Nothing is stored beyond the screen: the server decides who may
 * be listed, and decides again when the group is created.
 */
export function useGroupCandidates(rawKeyword: string): GroupCandidatesHandle {
    const typed = rawKeyword.trim();
    const [keyword, setKeyword] = useState(typed);
    const [attempt, setAttempt] = useState(0);
    const [loaded, setLoaded] = useState<Loaded | null>(null);

    // The search term settles after a pause. (The first one, the empty term, is asked for at once.)
    useEffect(() => {
        if (typed === keyword) return;
        const timer = setTimeout(() => setKeyword(typed), SEARCH_DELAY_MS);
        return () => clearTimeout(timer);
    }, [typed, keyword]);

    useEffect(() => {
        const controller = new AbortController();
        fetchGroupCandidates(keyword, controller.signal)
            .then(({ people, hasMore }) => setLoaded({ keyword, attempt, people, hasMore, error: null }))
            .catch((error: unknown) => {
                if (axios.isCancel(error)) return;
                setLoaded((previous) => ({
                    keyword,
                    attempt,
                    people: previous?.people ?? [],
                    hasMore: previous?.hasMore ?? false,
                    error: getErrorMessage(error),
                }));
            });
        return () => controller.abort();
    }, [keyword, attempt]);

    const retry = useCallback(() => setAttempt((current) => current + 1), []);

    const current = loaded !== null && loaded.keyword === keyword && loaded.attempt === attempt;
    return {
        people: loaded?.people ?? [],
        hasMore: loaded?.hasMore ?? false,
        loading: loaded === null,
        refreshing: typed !== keyword || !current,
        error: current && loaded.error ? loaded.error : null,
        retry,
    };
}
