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
                "group relative flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-start outline-none transition-colors",
                "hover:bg-(--chat-surface-2) focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring) active:bg-(--chat-surface-3)",
                active && "bg-(--chat-accent-soft) hover:bg-(--chat-accent-soft)"
            )}
        >
            {active && <span aria-hidden className="absolute start-0 top-3 bottom-3 w-1 rounded-full bg-(--chat-accent)" />}

            <Avatar className="mt-0.5 size-10 shrink-0 ring-1 ring-(--chat-line)">
                <AvatarImage src={senderImage} alt="" />
                <AvatarFallback
                    className={cn(
                        "text-xs font-semibold uppercase",
                        isMe ? "bg-(--chat-accent) text-(--chat-accent-ink)" : "bg-(--chat-surface-3) text-(--chat-ink-2)"
                    )}
                >
                    {senderName.slice(0, 2)}
                </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-(--chat-ink)">{senderName}</span>
                    {valid && (
                        <time
                            dateTime={sentAt.toISOString()}
                            title={fullDateTime.format(sentAt)}
                            className="shrink-0 text-xs text-(--chat-ink-3)"
                        >
                            {formatDayLabel(sentAt, today)}
                        </time>
                    )}
                </div>

                <div className="mt-0.5 flex items-start justify-between gap-2">
                    {/* dir="auto": an Arabic message reads (and aligns) right-to-left, an English one left-to-right. */}
                    <p dir="auto" className="line-clamp-2 min-w-0 text-start text-[14px] leading-[1.45] text-(--chat-ink-2) wrap-break-word">
                        {Icon && (
                            <Icon
                                aria-label={result.attachmentType ? ATTACHMENT_LABEL[result.attachmentType] : undefined}
                                className="me-1 mb-0.5 inline size-4 align-middle text-(--chat-ink-3)"
                            />
                        )}
                        <HighlightedText text={result.snippet} ranges={result.highlights} />
                        {result.attachmentCount > 1 && result.matchedIn === "text" && (
                            <span className="ms-1 inline-flex items-center gap-0.5 align-middle text-xs text-(--chat-ink-3)">
                                <PaperclipIcon className="size-3.5" aria-hidden />
                                {result.attachmentCount}
                            </span>
                        )}
                    </p>
                    {valid && <span className="mt-0.5 shrink-0 text-xs tabular-nums text-(--chat-ink-3)">{formatTime(sentAt)}</span>}
                </div>
            </div>
        </button>
    );
});
