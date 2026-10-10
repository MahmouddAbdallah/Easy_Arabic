"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { getErrorMessage } from "../lib/getErrorMessage";

/**
 * What the session (AppContext's user) does not carry: it only holds the columns the auth check selects, so
 * `createdAt` and `emailVerifiedAt` are not there even though the user type declares them.
 */
export interface AccountDetails {
    /** ISO time the account was created. */
    createdAt: string | null;
    /** ISO time the email was verified; null = not verified. */
    emailVerifiedAt: string | null;
}

export interface AccountDetailsHandle {
    /** `idle` until the first load starts; `loading` while a request is out; then `ready` or `error`. */
    status: "idle" | "loading" | "ready" | "error";
    details: AccountDetails | null;
    errorMessage: string | null;
    /** Tries again after an error. */
    retry: () => void;
}

type Loaded = { userId: string; status: "loading" | "ready" | "error"; details: AccountDetails | null; errorMessage: string | null };

/** A date the server sent, kept only when it really is one. */
function asIsoDate(value: unknown): string | null {
    if (typeof value !== "string" && !(value instanceof Date)) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * The signed-in user's own account facts, read from the same endpoint the chat uses to look people up
 * (`GET /api/users/{id}`; it never returns the password hash). Nothing is requested until `enabled`; once
 * loaded they are kept, so reopening the panel is instant. An error is retried on the next opening or with `retry`.
 */
export function useAccountDetails(userId: string | null | undefined, enabled: boolean): AccountDetailsHandle {
    const [state, setState] = useState<Loaded | null>(null);
    const [attempt, setAttempt] = useState(0);
    const loadedFor = useRef<string | null>(null);

    useEffect(() => {
        if (!enabled || !userId) return;
        if (loadedFor.current === userId) return;

        const controller = new AbortController();
        setState((previous) => ({
            userId,
            status: "loading",
            details: previous?.userId === userId ? previous.details : null,
            errorMessage: null,
        }));

        axios
            .get(`/api/users/${encodeURIComponent(userId)}`, { signal: controller.signal })
            .then(({ data }) => {
                const user: { createdAt?: unknown; emailVerifiedAt?: unknown } | undefined = data?.user;
                if (!user) throw new Error("The server sent no account details.");
                loadedFor.current = userId;
                setState({
                    userId,
                    status: "ready",
                    details: { createdAt: asIsoDate(user.createdAt), emailVerifiedAt: asIsoDate(user.emailVerifiedAt) },
                    errorMessage: null,
                });
            })
            .catch((error: unknown) => {
                if (axios.isCancel(error)) return;
                console.error("Could not load the account details:", error);
                setState({ userId, status: "error", details: null, errorMessage: getErrorMessage(error) });
            });

        return () => controller.abort();
    }, [userId, enabled, attempt]);

    const retry = useCallback(() => setAttempt((count) => count + 1), []);

    const current = state?.userId === userId ? state : null;
    return {
        status: current?.status ?? "idle",
        details: current?.details ?? null,
        errorMessage: current?.errorMessage ?? null,
        retry,
    };
}
