"use client";

import { EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "cn";
import { REACTION_KEYS, REACTION_META, type ReactionKey } from "../../lib/reactions";

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
 * Floating pill on the top edge of a bubble: the reaction picker, plus a menu with
 * Edit / Delete for the sender's own messages. It is portal-free (absolutely positioned) so it
 * never gets clipped by the scroll area, and only the menu itself is portaled.
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
        <div
            role="toolbar"
            aria-label="Message actions"
            className={cn(
                "absolute -top-4 z-20 flex items-center gap-0.5 rounded-full border border-border/50 bg-background/95 p-0.5 shadow-md backdrop-blur transition-opacity duration-150",
                isMe ? "right-1" : "left-1",
                visible
                    ? "pointer-events-auto opacity-100"
                    : "pointer-events-none opacity-0 group-focus-within/message:pointer-events-auto group-focus-within/message:opacity-100 group-hover/message:pointer-events-auto group-hover/message:opacity-100"
            )}
        >
            {REACTION_KEYS.map((key) => {
                const { emoji, label } = REACTION_META[key];
                const selected = myReaction === key;
                return (
                    <Button
                        key={key}
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={disabled}
                        aria-label={selected ? `Remove ${label} reaction` : `React with ${label}`}
                        aria-pressed={selected}
                        title={label}
                        onClick={() => onReact(key)}
                        className={cn(
                            "rounded-full text-[15px] leading-none",
                            selected && "bg-primary/10 ring-1 ring-primary/40 hover:bg-primary/15"
                        )}
                    >
                        {emoji}
                    </Button>
                );
            })}

            {hasMenu && (
                <>
                    <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
                    <DropdownMenu onOpenChange={onMenuOpenChange}>
                        <DropdownMenuTrigger
                            disabled={disabled}
                            aria-label="More actions"
                            render={<Button type="button" variant="ghost" size="icon-sm" className="rounded-full" />}
                        >
                            <EllipsisIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isMe ? "end" : "start"} className="w-36">
                            {canEdit && (
                                <DropdownMenuItem onClick={onEdit}>
                                    <PencilIcon />
                                    Edit
                                </DropdownMenuItem>
                            )}
                            {canEdit && canDelete && <DropdownMenuSeparator />}
                            {canDelete && (
                                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                                    <Trash2Icon />
                                    Delete
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </>
            )}
        </div>
    );
}
