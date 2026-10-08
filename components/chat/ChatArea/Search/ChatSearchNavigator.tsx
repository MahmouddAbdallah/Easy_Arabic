"use client";

import { ChevronDownIcon, ChevronUpIcon, Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
            className="flex shrink-0 items-center gap-1 border-t border-border/40 bg-card/60 px-2 py-1.5 backdrop-blur-md md:hidden"
        >
            <Button type="button" variant="ghost" onClick={onShowList} className="h-10 gap-1.5 rounded-xl px-3 text-xs font-medium">
                <SearchIcon aria-hidden /> Results
            </Button>

            <div className="min-w-0 flex-1 text-center" aria-live="polite">
                <p className="truncate text-xs font-semibold text-foreground" dir="auto">
                    {searchedQuery}
                </p>
                <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                    {loadingMore && <Loader2Icon className="size-3 animate-spin" aria-hidden />}
                    {position}
                </p>
            </div>

            <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Older match"
                disabled={!canGoOlder || loadingMore}
                onClick={() => onStep("older")}
                className="size-10 rounded-xl"
            >
                <ChevronUpIcon className="size-5" aria-hidden />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Newer match"
                disabled={!canGoNewer}
                onClick={() => onStep("newer")}
                className="size-10 rounded-xl"
            >
                <ChevronDownIcon className="size-5" aria-hidden />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close search"
                onClick={onClose}
                className="size-10 rounded-xl text-muted-foreground"
            >
                <XIcon className="size-4" aria-hidden />
            </Button>
        </div>
    );
}
