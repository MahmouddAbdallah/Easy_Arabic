"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { COMMENTS_CHANGED_EVENT, fetchPendingCommentCount } from "../lib/commentsApi";

/**
 * How many comments await review: the badge in the dashboard sidebar. Refreshes every minute, when the
 * tab regains focus, and right after any moderation action. Stops quietly if the signed-in user isn't
 * an admin (the endpoint answers 401/403), rather than polling something that will never work.
 */
export function usePendingCommentCount(intervalMs = 60_000): number {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let stopped = false;
        let controller: AbortController | null = null;

        const load = async () => {
            if (stopped || document.visibilityState === "hidden") return;
            controller?.abort();
            controller = new AbortController();
            try {
                const next = await fetchPendingCommentCount(controller.signal);
                if (!stopped) setCount(next);
            } catch (error) {
                if (axios.isCancel(error)) return;
                const status = axios.isAxiosError(error) ? error.response?.status : undefined;
                if (status === 401 || status === 403) stopped = true;
            }
        };

        void load();
        const timer = setInterval(load, intervalMs);
        window.addEventListener("focus", load);
        document.addEventListener("visibilitychange", load);
        window.addEventListener(COMMENTS_CHANGED_EVENT, load);
        return () => {
            stopped = true;
            controller?.abort();
            clearInterval(timer);
            window.removeEventListener("focus", load);
            document.removeEventListener("visibilitychange", load);
            window.removeEventListener(COMMENTS_CHANGED_EVENT, load);
        };
    }, [intervalMs]);

    return count;
}
