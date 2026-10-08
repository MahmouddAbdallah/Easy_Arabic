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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
        <div aria-hidden className="flex items-start gap-3 px-3 py-2.5">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2 pt-0.5">
                <div className="flex justify-between gap-6">
                    <Skeleton className="h-3 w-20 rounded-md" />
                    <Skeleton className="h-3 w-12 rounded-md" />
                </div>
                <Skeleton className="h-3 w-full rounded-md" />
                <Skeleton className="h-3 w-2/3 rounded-md" />
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
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span
                className={cn(
                    "grid size-12 place-items-center rounded-2xl",
                    tone === "error" ? "bg-destructive/10 text-destructive" : "bg-muted/60 text-muted-foreground"
                )}
            >
                <Icon className="size-5" aria-hidden />
            </span>
            <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{title}</p>
                {children && <div className="text-xs leading-relaxed text-muted-foreground">{children}</div>}
            </div>
        </div>
    );
}

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
                "flex flex-col bg-background animate-in fade-in-0 duration-150",
                // Phones: covers the chat. Wider: a column beside it.
                "absolute inset-0 z-30",
                "md:static md:inset-auto md:z-auto md:w-88 md:shrink-0 md:border-l md:border-border/40 md:bg-card/20 md:backdrop-blur-md md:slide-in-from-right-4 lg:w-96",
                !listVisible && "max-md:hidden"
            )}
        >
            <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border/40 px-3 md:px-4">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    aria-label="Close search"
                    className="size-9 rounded-xl text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeftIcon className="size-5 md:hidden" aria-hidden />
                    <XIcon className="hidden size-4 md:block" aria-hidden />
                </Button>
                <h2 className="text-sm font-semibold tracking-tight text-foreground">Search messages</h2>
            </div>

            <div className="shrink-0 space-y-2 px-3 pt-3 pb-1">
                <div className="group relative flex items-center">
                    <SearchIcon
                        aria-hidden
                        className="pointer-events-none absolute start-3 z-10 size-3.5 text-muted-foreground/60 transition-colors group-focus-within:text-primary"
                    />
                    <Input
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
                        // The chat root is `select-none`; Safari would then refuse to let you type here.
                        className="h-10 select-text rounded-xl border-border/40 bg-muted/30 ps-9 pe-9 text-base shadow-none placeholder:text-muted-foreground/60 focus-visible:bg-background/80 focus-visible:ring-1 focus-visible:ring-primary/40 md:text-xs"
                    />
                    <div className="absolute end-2 z-10 flex items-center">
                        {busy ? (
                            <Loader2Icon aria-hidden className="size-3.5 animate-spin text-primary" />
                        ) : typed ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Clear search"
                                onClick={() => {
                                    setQuery("");
                                    inputRef.current?.focus();
                                }}
                                className="size-6 rounded-full text-muted-foreground/70 hover:text-foreground"
                            >
                                <XIcon className="size-3" aria-hidden />
                            </Button>
                        ) : null}
                    </div>
                </div>

                <p aria-live="polite" className="min-h-4 px-1 text-[11px] font-medium text-muted-foreground/80">
                    {summary}
                </p>
            </div>

            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
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
                        <Button type="button" variant="outline" size="sm" onClick={retry} className="mt-3 rounded-full">
                            <RotateCcw /> Try again
                        </Button>
                    </Notice>
                ) : results.length === 0 ? (
                    <Notice icon={SearchXIcon} title={`No messages found for “${searchedQuery}”`}>
                        {hasMore ? (
                            <>
                                <p>
                                    Nothing in the latest {scanned.toLocaleString()} messages. There is older history
                                    left to look through.
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void loadMore()}
                                    disabled={loadingMore}
                                    className="mt-3 rounded-full"
                                >
                                    {loadingMore ? <Loader2Icon className="animate-spin" /> : <ChevronDownIcon />}
                                    Search older messages
                                </Button>
                            </>
                        ) : (
                            <p>Check the spelling or try a different word.</p>
                        )}
                    </Notice>
                ) : (
                    <>
                        <ul
                            aria-label="Search results"
                            className={cn("space-y-0.5 transition-opacity", busy && "opacity-60")}
                        >
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

                        <div ref={sentinelRef} className="flex flex-col items-center gap-2 px-3 py-4 text-center">
                            {loadingMore ? (
                                <p role="status" className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <Loader2Icon className="size-3.5 animate-spin text-primary" aria-hidden />
                                    Searching older messages…
                                </p>
                            ) : error ? (
                                <>
                                    <p className="text-[11px] text-destructive">{error}</p>
                                    <Button type="button" variant="outline" size="sm" onClick={() => void loadMore()} className="rounded-full">
                                        <RotateCcw /> Try again
                                    </Button>
                                </>
                            ) : hasMore ? (
                                <Button type="button" variant="ghost" size="sm" onClick={() => void loadMore()} className="rounded-full text-xs text-muted-foreground">
                                    <ChevronDownIcon /> Search older messages
                                </Button>
                            ) : (
                                <p className="text-[11px] text-muted-foreground/70">That&apos;s everything in this conversation.</p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}
