"use client";

import { cn } from "cn";
import { summarizeReactions, type ReactionKey, type ReactionMap } from "../../lib/reactions";

interface ReactionSummaryProps {
    reactions: ReactionMap;
    currentUserId: string;
    /** Used only for the hover title ("You, Sara"). */
    otherUserName?: string;
    /** In a group there are several others: how to name each one. Falls back to `otherUserName`. */
    nameOfUser?: (userId: string) => string | undefined;
    isMe: boolean;
    disabled: boolean;
    onToggle: (reaction: ReactionKey) => void;
}

/** Reaction chips tucked under a bubble. Clicking a chip toggles the current user's reaction. */
export function ReactionSummary({ reactions, currentUserId, otherUserName, nameOfUser, isMe, disabled, onToggle }: ReactionSummaryProps) {
    const items = summarizeReactions(reactions, currentUserId);
    if (items.length === 0) return null;

    return (
        <div
            role="group"
            aria-label="Reactions"
            className={cn("relative z-10 -mt-2.5 flex flex-wrap gap-1 px-3", isMe ? "justify-end" : "justify-start")}
        >
            {items.map((item) => {
                const names = item.userIds.map((id) => (id === currentUserId ? "You" : nameOfUser?.(id) || otherUserName || "Someone")).join(", ");
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
                            "inline-flex h-6 items-center gap-1 rounded-full border px-1.5 text-xs leading-none shadow-(--chat-shadow-sm) outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring) disabled:cursor-not-allowed disabled:opacity-60",
                            item.reactedByMe
                                ? "border-(--chat-accent-ring) bg-(--chat-accent-soft) font-semibold text-(--chat-accent-text)"
                                : "border-(--chat-line) bg-(--chat-surface) text-(--chat-ink-2) hover:bg-(--chat-surface-3)"
                        )}
                    >
                        <span className="text-[13px]">{item.emoji}</span>
                        {item.count > 1 && <span className="tabular-nums">{item.count}</span>}
                    </button>
                );
            })}
        </div>
    );
}
