"use client";

import { EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "cn";
import { REACTION_KEYS, REACTION_META, type ReactionKey } from "../../lib/reactions";
import { ui } from "../../lib/chatTheme";

interface MessageToolbarProps {
    isMe: boolean;
    /** Force-visible (touch tap / menu open). On desktop it also shows on hover and keyboard focus. */
    visible: boolean;
    disabled: boolean;
    myReaction: ReactionKey | null;
    canEdit: boolean;
    canDelete: boolean;
    onReact: (reaction: ReactionKey) => void;
    onEdit: () => void;
    onDelete: () => void;
    onMenuOpenChange: (open: boolean) => void;
}

/**
 * Floating pill above a bubble: the reaction picker, plus a menu with Edit / Delete for the sender's own messages.
 * It is portal-free (absolutely positioned) so it never gets clipped by the scroller; only the menu is portaled.
 */
export function MessageToolbar({
    isMe,
    visible,
    disabled,
    myReaction,
    canEdit,
    canDelete,
    onReact,
    onEdit,
    onDelete,
    onMenuOpenChange,
}: MessageToolbarProps) {
    const hasMenu = canEdit || canDelete;

    return (
        // The outer box reaches down to the bubble (transparent `pb-2`), so moving the pointer from the bubble up to the
        // pill never leaves the hover area; the pill itself stays clear of the bubble it belongs to.
        <div
            role="toolbar"
            aria-label="Message actions"
            className={cn(
                "absolute -top-[46px] z-20 pb-2 transition-[opacity,transform] duration-150",
                isMe ? "right-1" : "left-1",
                visible
                    ? "pointer-events-auto translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-1 opacity-0 group-focus-within/message:pointer-events-auto group-focus-within/message:translate-y-0 group-focus-within/message:opacity-100 group-hover/message:pointer-events-auto group-hover/message:translate-y-0 group-hover/message:opacity-100"
            )}
        >
            <div className="flex items-center gap-0.5 rounded-full border border-(--chat-line) bg-(--chat-surface) p-1 shadow-(--chat-shadow-md)">
                {REACTION_KEYS.map((key) => {
                    const { emoji, label } = REACTION_META[key];
                    const selected = myReaction === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            disabled={disabled}
                            aria-label={selected ? `Remove ${label} reaction` : `React with ${label}`}
                            aria-pressed={selected}
                            title={label}
                            onClick={() => onReact(key)}
                            className={cn(
                                "inline-flex size-8 items-center justify-center rounded-full text-[17px] leading-none outline-none transition-[background-color,transform] hover:scale-110 hover:bg-(--chat-surface-3) focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring) disabled:pointer-events-none disabled:opacity-50",
                                selected && "bg-(--chat-accent-soft) ring-1 ring-(--chat-accent-ring) hover:bg-(--chat-accent-soft)"
                            )}
                        >
                            {emoji}
                        </button>
                    );
                })}

                {hasMenu && (
                    <>
                        <span aria-hidden className="mx-0.5 h-5 w-px bg-(--chat-line)" />
                        <DropdownMenu onOpenChange={onMenuOpenChange}>
                            <DropdownMenuTrigger
                                disabled={disabled}
                                aria-label="More actions"
                                className={cn(ui.iconButton, "size-8 [&_svg]:size-4")}
                            >
                                <EllipsisIcon />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isMe ? "end" : "start"} className={cn(ui.layer, "w-40 rounded-2xl p-1.5")}>
                                {canEdit && (
                                    <DropdownMenuItem className="gap-2.5 rounded-xl px-2.5 py-2 text-sm" onClick={onEdit}>
                                        <PencilIcon />
                                        Edit
                                    </DropdownMenuItem>
                                )}
                                {canEdit && canDelete && <DropdownMenuSeparator />}
                                {canDelete && (
                                    <DropdownMenuItem variant="destructive" className="gap-2.5 rounded-xl px-2.5 py-2 text-sm" onClick={onDelete}>
                                        <Trash2Icon />
                                        Delete
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </>
                )}
            </div>
        </div>
    );
}
