"use client";

import { cn } from "cn";
import { summarizeReactions, type ReactionKey, type ReactionMap } from "../../lib/reactions";

interface ReactionSummaryProps {
    reactions: ReactionMap;
    currentUserId: string;
    /** Used only for the hover title ("You, Sara"). */
    otherUserName?: string;
    isMe: boolean;
    disabled: boolean;
    onToggle: (reaction: ReactionKey) => void;
}

/** Reaction chips under a bubble. Clicking a chip toggles the current user's reaction. */
export function ReactionSummary({
    reactions,
    currentUserId,
    otherUserName,
    isMe,
    disabled,
    onToggle,
}: ReactionSummaryProps) {
    const items = summarizeReactions(reactions, currentUserId);
    if (items.length === 0) return null;

    return (
        <div
            role="group"
            aria-label="Reactions"
            className={cn("relative z-10 -mt-2 flex flex-wrap gap-1 px-2", isMe ? "justify-end" : "justify-start")}
        >
            {items.map((item) => {
                const names = item.userIds
                    .map((id) => (id === currentUserId ? "You" : otherUserName || "Someone"))
                    .join(", ");
                return (
                    <button
                        key={item.key}
                        type="button"
                        disabled={disabled}
                        aria-pressed={item.reactedByMe}
                        aria-label={`${item.label}: ${item.count}. ${item.reactedByMe ? "Remove your reaction" : "React"}`}
                        title={`${item.label} · ${names}`}
                        onClick={() => onToggle(item.key)}
                        className={cn(
                            "inline-flex items-center gap-1 rounded-full border bg-background px-1.5 py-0.5 text-[10px] leading-none shadow-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                            item.reactedByMe
                                ? "border-primary/50 bg-primary/10 font-semibold text-primary"
                                : "border-border/60 text-muted-foreground hover:bg-muted"
                        )}
                    >
                        <span className="text-[12px]">{item.emoji}</span>
                        <span>{item.count}</span>
                    </button>
                );
            })}
        </div>
    );
}
