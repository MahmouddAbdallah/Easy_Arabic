"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import {
    AlertCircleIcon,
    ArrowLeftIcon,
    ChevronDownIcon,
    Loader2Icon,
    RotateCcw,
    SearchIcon,
    SearchXIcon,
    XIcon,
    type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { ui } from "../../lib/chatTheme";
import { CHAT_SEARCH_MAX_QUERY_LENGTH, CHAT_SEARCH_PANEL_ID, type ChatSearchResult } from "../../lib/chatSearch";
import { useToday } from "../../hooks/useToday";
import type { ChatSearchController } from "../../hooks/useChatSearch";
import { SearchResultItem } from "./SearchResultItem";

interface Person {
    id?: string;
    name?: string;
    imageUrl?: string;
}

interface ChatSearchPanelProps {
    search: ChatSearchController;
    me: Person;
    other: Person;
    /**
     * Phones only. The panel covers the whole chat there, and steps aside once a result is chosen so the
     * message can be seen (the navigator bar then takes over). On wider screens it is a side column and
     * is always shown.
     */
    listVisible: boolean;
    onSelect: (result: ChatSearchResult) => void;
    onStep: (direction: "older" | "newer") => void;
    onClose: () => void;
}

const SKELETON_ROWS = 5;

function ResultSkeleton() {
    return (
        <div aria-hidden className="flex items-start gap-3 px-3 py-3">
            <div className="chat-skeleton size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2.5 pt-0.5">
                <div className="flex justify-between gap-6">
                    <div className="chat-skeleton h-3 w-20 rounded-md" />
                    <div className="chat-skeleton h-3 w-12 rounded-md" />
                </div>
                <div className="chat-skeleton h-3 w-full rounded-md" />
                <div className="chat-skeleton h-3 w-2/3 rounded-md" />
            </div>
        </div>
    );
}

interface MessageProps {
    icon: LucideIcon;
    title: string;
    children?: ReactNode;
    tone?: "default" | "error";
}

/** A centred notice (nothing typed yet, no results, an error) */
function Notice({ icon: Icon, title, children, tone = "default" }: MessageProps) {
    return (
        <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
            <span
                className={cn(
                    "grid size-14 place-items-center rounded-full",
                    tone === "error" ? "bg-(--chat-danger-soft) text-(--chat-danger)" : "bg-(--chat-accent-soft) text-(--chat-accent-text)"
                )}
            >
                <Icon className="size-6" aria-hidden />
            </span>
            <div className="space-y-1.5">
                <p className="text-base font-semibold text-(--chat-ink)">{title}</p>
                {children && <div className="text-sm leading-relaxed text-(--chat-ink-2)">{children}</div>}
            </div>
        </div>
    );
}

const pillButton =
    "inline-flex h-9 items-center justify-center gap-2 rounded-full border border-(--chat-line-strong) bg-(--chat-surface) px-4 text-[13px] font-medium text-(--chat-ink) outline-none transition-colors hover:bg-(--chat-surface-3) focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring) disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4";

export function ChatSearchPanel({ search, me, other, listVisible, onSelect, onStep, onClose }: ChatSearchPanelProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const today = useToday();

    const {
        query,
        setQuery,
        status,
        results,
        error,
        loadingMore,
        scanned,
        searchedQuery,
        activeId,
        activeIndex,
        hasMore,
        pageFull,
        loadMore,
        retry,
    } = search;

    const typed = query.trim().length > 0;
    const busy = status === "loading";
    const firstLoad = busy && results.length === 0;

    // Opening the search puts the cursor in the box (on a phone, that also raises the keyboard).
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Arrowing through the results must keep the selected one in view.
    useEffect(() => {
        if (!activeId) return;
        listRef.current
            ?.querySelector(`[data-result-id="${CSS.escape(activeId)}"]`)
            ?.scrollIntoView({ block: "nearest" });
    }, [activeId]);

    // Infinite scroll, but only while the last response filled a whole page: that means the list is long
    // enough to need scrolling, and the next page is cheap. When a rare word came up short (the server
    // gave up on its budget, not on its results) it is the button below that goes on, never a loop.
    useEffect(() => {
        const sentinel = sentinelRef.current;
        const root = listRef.current;
        if (!sentinel || !root || status !== "ready" || !hasMore || !pageFull || loadingMore || error) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) void loadMore();
            },
            { root, rootMargin: "0px 0px 160px 0px" }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [status, hasMore, pageFull, loadingMore, error, loadMore, results.length]);

    const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.nativeEvent.isComposing) return; // an IME is still choosing characters

        switch (event.key) {
            case "Enter": {
                event.preventDefault();
                if (status !== "ready" || results.length === 0) return;
                // Like find-in-page: Enter goes on to the next match, Shift+Enter back to the previous one.
                if (event.shiftKey) onStep("newer");
                else if (activeIndex === -1) onSelect(results[0]);
                else onStep("older");
                return;
            }
            case "ArrowDown":
                event.preventDefault();
                onStep("older");
                return;
            case "ArrowUp":
                event.preventDefault();
                onStep("newer");
                return;
            case "Escape":
                // First Escape empties the box; the next one (nothing left to clear) closes the search.
                if (query) {
                    event.preventDefault();
                    event.stopPropagation();
                    setQuery("");
                }
                return;
        }
    };

    let summary = "";
    if (firstLoad) summary = scanned > 0 ? `Searching older messages… ${scanned.toLocaleString()} checked` : "Searching…";
    else if (results.length > 0) {
        summary = `${results.length}${hasMore ? "+" : ""} ${results.length === 1 && !hasMore ? "result" : "results"} · newest first`;
    }

    const senderOf = (result: ChatSearchResult) =>
        result.senderId === me.id
            ? { name: "You", image: me.imageUrl, isMe: true }
            : { name: other.name || "User", image: other.imageUrl, isMe: false };

    return (
        <section
            id={CHAT_SEARCH_PANEL_ID}
            role="search"
            aria-label="Search messages"
            onKeyDown={(event) => {
                if (event.key === "Escape") onClose();
            }}
            className={cn(
                "chat-rise flex flex-col bg-(--chat-surface)",
                // Phones: covers the chat. Wider: a column beside it.
                "absolute inset-0 z-30",
                "md:static md:inset-auto md:z-auto md:w-[360px] md:shrink-0 md:border-s md:border-(--chat-line) lg:w-[400px]",
                !listVisible && "max-md:hidden"
            )}
        >
            <div className="flex h-[68px] shrink-0 items-center gap-1 border-b border-(--chat-line) px-2 md:px-3">
                <button type="button" onClick={onClose} aria-label="Close search" className={ui.iconButton}>
                    <ArrowLeftIcon className="md:hidden" aria-hidden />
                    <XIcon className="hidden md:block" aria-hidden />
                </button>
                <h2 className="text-base font-semibold text-(--chat-ink)">Search in chat</h2>
            </div>

            <div className="shrink-0 space-y-2 px-3 pb-1 pt-3">
                <div className="group relative flex items-center">
                    <SearchIcon
                        aria-hidden
                        className="pointer-events-none absolute start-3.5 z-10 size-[18px] text-(--chat-ink-3) transition-colors group-focus-within:text-(--chat-accent-text)"
                    />
                    <input
                        ref={inputRef}
                        // Arabic typed here must read right-to-left, English left-to-right.
                        dir="auto"
                        role="searchbox"
                        value={query}
                        maxLength={CHAT_SEARCH_MAX_QUERY_LENGTH}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={handleInputKeyDown}
                        placeholder="Search this conversation"
                        aria-label="Search messages in this conversation"
                        inputMode="search"
                        enterKeyHint="search"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        className={cn(ui.field, "select-text ps-11 pe-11")}
                    />
                    <div className="absolute end-2 z-10 flex items-center">
                        {busy ? (
                            <Loader2Icon aria-hidden className="mx-2 size-4 animate-spin text-(--chat-accent-text)" />
                        ) : typed ? (
                            <button
                                type="button"
                                aria-label="Clear search"
                                onClick={() => {
                                    setQuery("");
                                    inputRef.current?.focus();
                                }}
                                className="grid size-7 place-items-center rounded-full text-(--chat-ink-3) outline-none transition-colors hover:bg-(--chat-line) hover:text-(--chat-ink) focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring)"
                            >
                                <XIcon className="size-4" aria-hidden />
                            </button>
                        ) : null}
                    </div>
                </div>

                <p aria-live="polite" className="min-h-5 px-2 text-[13px] text-(--chat-ink-3)">
                    {summary}
                </p>
            </div>

            <div ref={listRef} className="chat-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-4">
                {status === "idle" || (!typed && results.length === 0) ? (
                    <Notice icon={SearchIcon} title="Search this conversation">
                        Type a word to find it in every message, including older ones that aren&apos;t on screen. File
                        names count too.
                    </Notice>
                ) : firstLoad ? (
                    <div role="status" aria-label="Searching" className="space-y-0.5">
                        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
                            <ResultSkeleton key={index} />
                        ))}
                    </div>
                ) : status === "error" && results.length === 0 ? (
                    <Notice icon={AlertCircleIcon} title="Couldn't search" tone="error">
                        <p>{error ?? "Something went wrong. Please try again."}</p>
                        <button type="button" onClick={retry} className={cn(pillButton, "mt-4")}>
                            <RotateCcw /> Try again
                        </button>
                    </Notice>
                ) : results.length === 0 ? (
                    <Notice icon={SearchXIcon} title={`No messages found for “${searchedQuery}”`}>
                        {hasMore ? (
                            <>
                                <p>
                                    Nothing in the latest {scanned.toLocaleString()} messages. There is older history
                                    left to look through.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => void loadMore()}
                                    disabled={loadingMore}
                                    className={cn(pillButton, "mt-4")}
                                >
                                    {loadingMore ? <Loader2Icon className="animate-spin" /> : <ChevronDownIcon />}
                                    Search older messages
                                </button>
                            </>
                        ) : (
                            <p>Check the spelling or try a different word.</p>
                        )}
                    </Notice>
                ) : (
                    <>
                        <ul aria-label="Search results" className={cn("space-y-0.5 transition-opacity", busy && "opacity-60")}>
                            {results.map((result) => {
                                const sender = senderOf(result);
                                return (
                                    <li key={result.id}>
                                        <SearchResultItem
                                            result={result}
                                            senderName={sender.name}
                                            senderImage={sender.image}
                                            isMe={sender.isMe}
                                            active={result.id === activeId}
                                            today={today}
                                            onSelect={onSelect}
                                        />
                                    </li>
                                );
                            })}
                        </ul>

                        <div ref={sentinelRef} className="flex flex-col items-center gap-2 px-3 py-5 text-center">
                            {loadingMore ? (
                                <p role="status" className="flex items-center gap-2 text-[13px] text-(--chat-ink-2)">
                                    <Loader2Icon className="size-4 animate-spin text-(--chat-accent-text)" aria-hidden />
                                    Searching older messages…
                                </p>
                            ) : error ? (
                                <>
                                    <p className="text-[13px] text-(--chat-danger)">{error}</p>
                                    <button type="button" onClick={() => void loadMore()} className={pillButton}>
                                        <RotateCcw /> Try again
                                    </button>
                                </>
                            ) : hasMore ? (
                                <button type="button" onClick={() => void loadMore()} className={pillButton}>
                                    <ChevronDownIcon /> Search older messages
                                </button>
                            ) : (
                                <p className="text-[13px] text-(--chat-ink-3)">That&apos;s everything in this conversation.</p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}
