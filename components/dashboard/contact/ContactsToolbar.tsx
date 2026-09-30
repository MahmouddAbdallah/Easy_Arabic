"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { CornerDownLeft, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ContactStatus, MAX_KEYWORD_LENGTH } from "./contactUtils";
import type { ContactQueryApi } from "./useContactQuery";

export type ContactCounts = Partial<Record<"all" | ContactStatus, number>>;

const TABS: { value: ContactStatus | null; label: string; countKey: keyof ContactCounts }[] = [
    { value: null, label: "All", countKey: "all" },
    { value: "unread", label: "Unread", countKey: "unread" },
    { value: "read", label: "Read", countKey: "read" },
];

const isTypingTarget = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
};

interface ContactsToolbarProps {
    api: ContactQueryApi;
    /** Optional per-tab totals. Tabs without a number simply show their label. */
    counts?: ContactCounts;
}

export function ContactsToolbar({ api, counts }: ContactsToolbarProps) {
    const { query, status, isPending, setKeyword, clearKeyword, setStatus } = api;
    const inputRef = useRef<HTMLInputElement>(null);

    // The box holds a draft; the URL only changes on Enter / Search.
    // When the URL changes from elsewhere (back button, "Clear filters"), the draft follows.
    const [draft, setDraft] = useState(query.keyword);
    const [syncedKeyword, setSyncedKeyword] = useState(query.keyword);
    if (query.keyword !== syncedKeyword) {
        setSyncedKeyword(query.keyword);
        setDraft(query.keyword);
    }

    // "/" focuses search, like most mail clients.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
            if (isTypingTarget(event.target)) return;
            event.preventDefault();
            inputRef.current?.focus();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        setKeyword(draft);
    };

    const clear = () => {
        setDraft("");
        if (query.keyword) clearKeyword();
        inputRef.current?.focus();
    };

    // The apply button only appears when there is something new to apply.
    const isDirty = draft.trim() !== query.keyword;
    const hasDraft = draft.length > 0;

    return (
        <div className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
            <form onSubmit={submit} role="search" className="w-full lg:max-w-md">
                <div
                    className={cn(
                        "flex h-10 items-center gap-2 rounded-lg border border-input bg-background pl-3 pr-1.5 transition-[border-color,box-shadow] sm:h-9",
                        "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
                    )}
                >
                    {isPending ? (
                        <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : (
                        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    )}

                    <input
                        ref={inputRef}
                        type="text"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Escape") {
                                if (draft) setDraft(query.keyword);
                                else event.currentTarget.blur();
                            }
                        }}
                        maxLength={MAX_KEYWORD_LENGTH}
                        placeholder="Search name, email or subject"
                        aria-label="Search messages"
                        autoComplete="off"
                        enterKeyHint="search"
                        className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
                    />

                    {hasDraft && (
                        <button
                            type="button"
                            onClick={clear}
                            aria-label="Clear search"
                            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                            <X className="size-3.5" />
                        </button>
                    )}

                    {isDirty ? (
                        <Button type="submit" size="sm" disabled={isPending} className="shrink-0 gap-1.5">
                            Search
                            <CornerDownLeft aria-hidden className="hidden size-3 opacity-70 sm:block" />
                        </Button>
                    ) : (
                        !hasDraft && (
                            <kbd
                                aria-hidden
                                className="pointer-events-none mr-1 hidden rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground lg:block"
                            >
                                /
                            </kbd>
                        )
                    )}
                </div>
            </form>

            <div
                role="group"
                aria-label="Filter by status"
                className="grid grid-cols-3 gap-0.5 rounded-lg bg-muted p-0.5 lg:inline-flex"
            >
                {TABS.map((tab) => {
                    const active = status === tab.value;
                    const count = counts?.[tab.countKey];
                    return (
                        <button
                            key={tab.label}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setStatus(tab.value)}
                            className={cn(
                                "flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                                active
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {tab.label}
                            {typeof count === "number" && (
                                <span
                                    className={cn(
                                        "rounded-full px-1.5 text-[11px] tabular-nums",
                                        active ? "bg-muted text-foreground" : "text-muted-foreground",
                                        tab.value === "unread" && count > 0 && "text-blue-600 dark:text-blue-400",
                                    )}
                                >
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
