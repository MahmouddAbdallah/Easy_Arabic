"use client";

import { ChevronDownIcon, ChevronUpIcon, Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { ui } from "../../lib/chatTheme";
import type { ChatSearchController } from "../../hooks/useChatSearch";

interface ChatSearchNavigatorProps {
    search: ChatSearchController;
    onStep: (direction: "older" | "newer") => void;
    onShowList: () => void;
    onClose: () => void;
}

/**
 * Phones only. While a chosen message is on screen, this bar (above the composer) keeps the search within
 * reach: back to the list, previous / next match, close. Up goes to an OLDER match, because that is
 * the way the conversation scrolls; "3 of 20+" is the place in the list (newest first), the "+" meaning
 * older history hasn't been searched yet.
 */
export function ChatSearchNavigator({ search, onStep, onShowList, onClose }: ChatSearchNavigatorProps) {
    const { activeIndex, results, hasMore, loadingMore, canGoOlder, canGoNewer, searchedQuery } = search;
    const position = activeIndex >= 0 ? `${activeIndex + 1} of ${results.length}${hasMore ? "+" : ""}` : `${results.length}${hasMore ? "+" : ""} found`;

    return (
        <div
            role="toolbar"
            aria-label="Search results navigation"
            className="flex shrink-0 items-center gap-1 border-t border-(--chat-line) bg-(--chat-surface) px-2 py-1.5 md:hidden"
        >
            <button
                type="button"
                onClick={onShowList}
                className="inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-(--chat-accent-text) outline-none transition-colors hover:bg-(--chat-accent-soft) focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring) [&_svg]:size-4"
            >
                <SearchIcon aria-hidden /> Results
            </button>

            <div className="min-w-0 flex-1 text-center" aria-live="polite">
                <p className="truncate text-sm font-semibold text-(--chat-ink)" dir="auto">
                    {searchedQuery}
                </p>
                <p className="flex items-center justify-center gap-1 text-xs text-(--chat-ink-3)">
                    {loadingMore && <Loader2Icon className="size-3 animate-spin" aria-hidden />}
                    {position}
                </p>
            </div>

            <button type="button" aria-label="Older match" disabled={!canGoOlder || loadingMore} onClick={() => onStep("older")} className={ui.iconButton}>
                <ChevronUpIcon aria-hidden />
            </button>
            <button type="button" aria-label="Newer match" disabled={!canGoNewer} onClick={() => onStep("newer")} className={ui.iconButton}>
                <ChevronDownIcon aria-hidden />
            </button>
            <button type="button" aria-label="Close search" onClick={onClose} className={cn(ui.iconButton, "text-(--chat-ink-3)")}>
                <XIcon aria-hidden />
            </button>
        </div>
    );
}
