"use client";

import { memo } from "react";
import { FileTextIcon, ImageIcon, Mic2Icon, PaperclipIcon, VideoIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDayLabel } from "../../lib/dateSeparators";
import type { ChatSearchResult } from "../../lib/chatSearch";
import type { AttachmentType } from "../../types";
import { HighlightedText } from "./HighlightedText";

const ATTACHMENT_ICON: Record<AttachmentType, LucideIcon> = {
    image: ImageIcon,
    video: VideoIcon,
    audio: Mic2Icon,
    file: FileTextIcon,
};

const ATTACHMENT_LABEL: Record<AttachmentType, string> = {
    image: "Photo",
    video: "Video",
    audio: "Voice message",
    file: "File",
};

/** Same format as the time inside the message bubbles. */
const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const fullDateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" });

interface SearchResultItemProps {
    result: ChatSearchResult;
    /** Who sent it, already worked out: "You" or the other person's name. */
    senderName: string;
    senderImage?: string;
    isMe: boolean;
    active: boolean;
    today: Date;
    onSelect: (result: ChatSearchResult) => void;
}

/** One match in the results list: who, when, and the words in context with the match marked. */
export const SearchResultItem = memo(function SearchResultItem({
    result,
    senderName,
    senderImage,
    isMe,
    active,
    today,
    onSelect,
}: SearchResultItemProps) {
    const sentAt = new Date(result.time);
    const valid = !Number.isNaN(sentAt.getTime());
    const Icon = result.attachmentType ? ATTACHMENT_ICON[result.attachmentType] : null;

    return (
        <button
            type="button"
            data-result-id={result.id}
            aria-current={active ? "true" : undefined}
            onClick={() => onSelect(result)}
            className={cn(
                "group relative flex w-full items-start gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-start outline-none transition-colors",
                "hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 active:bg-accent/70",
                active && "border-border/60 bg-accent/50"
            )}
        >
            {active && <span aria-hidden className="absolute start-1 top-2.5 bottom-2.5 w-1 rounded-full bg-primary" />}

            <Avatar className="mt-0.5 size-9 shrink-0 ring-1 ring-border/40">
                <AvatarImage src={senderImage} alt="" />
                <AvatarFallback className={cn("text-[11px] font-bold uppercase", isMe ? "bg-primary/15 text-primary" : "bg-muted")}>
                    {senderName.slice(0, 2)}
                </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-foreground">{senderName}</span>
                    {valid && (
                        <time
                            dateTime={sentAt.toISOString()}
                            title={fullDateTime.format(sentAt)}
                            className="shrink-0 text-[10px] font-medium text-muted-foreground/80"
                        >
                            {formatDayLabel(sentAt, today)}
                        </time>
                    )}
                </div>

                <div className="mt-0.5 flex items-start justify-between gap-2">
                    {/* dir="auto": an Arabic message reads (and aligns) right-to-left, an English one left-to-right. */}
                    <p dir="auto" className="line-clamp-2 min-w-0 text-start text-xs leading-relaxed text-muted-foreground wrap-break-word">
                        {Icon && (
                            <Icon
                                aria-label={result.attachmentType ? ATTACHMENT_LABEL[result.attachmentType] : undefined}
                                className="me-1 mb-0.5 inline size-3.5 align-middle text-muted-foreground/80"
                            />
                        )}
                        <HighlightedText text={result.snippet} ranges={result.highlights} />
                        {result.attachmentCount > 1 && result.matchedIn === "text" && (
                            <span className="ms-1 inline-flex items-center gap-0.5 align-middle text-[10px] text-muted-foreground/70">
                                <PaperclipIcon className="size-3" aria-hidden />
                                {result.attachmentCount}
                            </span>
                        )}
                    </p>
                    {valid && <span className="mt-0.5 shrink-0 text-[10px] tabular-nums text-muted-foreground/70">{formatTime(sentAt)}</span>}
                </div>
            </div>
        </button>
    );
});
