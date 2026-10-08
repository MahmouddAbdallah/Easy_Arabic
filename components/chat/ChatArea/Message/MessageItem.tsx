"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { BanIcon, CheckCheck } from "lucide-react";
import { cn } from "cn";
import Attachment from "../Attachment";
import { findHighlights } from "../../lib/chatSearch";
import { DELETED_MESSAGE_TEXT } from "../../lib/constants";
import type { ReactionKey } from "../../lib/reactions";
import type { MessageType } from "../../types";
import { EditMessageForm } from "./EditMessageForm";
import { MessageToolbar } from "./MessageToolbar";
import { ReactionSummary } from "./ReactionSummary";
import { HighlightedText } from "../Search/HighlightedText";

const NO_TERMS: readonly string[] = [];

interface MessageItemProps {
    message: MessageType;
    currentUserId: string;
    otherUserName?: string;
    isEditing: boolean;
    /** A request for this message is in flight. */
    isPending: boolean;
    onReact: (messageId: string, reaction: ReactionKey | null) => void;
    onStartEdit: (messageId: string) => void;
    onCancelEdit: () => void;
    onSaveEdit: (messageId: string, text: string) => void;
    onRequestDelete: (message: MessageType) => void;
    /** Words of the search in progress (already in comparable form): where they occur in the text they are marked. */
    highlightTerms?: readonly string[];
    /** This is the message the search just jumped to: it gets a ring for a moment so the eye finds it. */
    isFlashing?: boolean;
}

export const MessageItem = memo(function MessageItem({
    message,
    currentUserId,
    otherUserName,
    isEditing,
    isPending,
    onReact,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onRequestDelete,
    highlightTerms = NO_TERMS,
    isFlashing = false,
}: MessageItemProps) {
    const { isMe, deleted } = message;
    const [tapped, setTapped] = useState(false); // touch: tap the bubble to reveal the toolbar
    const [menuOpen, setMenuOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    const canInteract = !deleted && !isEditing;
    const hasAttachments = message.attachments.length > 0;
    const myReaction = message.reactions[currentUserId] ?? null;
    // Only worked out while a search is showing words: otherwise every bubble would fold its text for nothing.
    const highlights = useMemo(
        () => (highlightTerms.length > 0 && message.text ? (findHighlights(message.text, highlightTerms) ?? []) : []),
        [highlightTerms, message.text]
    );

    // Tapping anywhere outside this message closes the touch toolbar.
    useEffect(() => {
        if (!tapped) return;
        const onPointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setTapped(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [tapped]);

    // Selecting the same reaction again removes it; selecting another one replaces it.
    const handleReact = (key: ReactionKey) => {
        setTapped(false);
        onReact(message.id, myReaction === key ? null : key);
    };

    const bubbleClass = cn(
        "p-3.5 md:p-4 rounded-2xl text-xs relative transition-all duration-200 shadow-sm",
        // A ring takes no room, so flashing never moves the conversation.
        isFlashing && "ring-2 ring-primary/70 ring-offset-2 ring-offset-background",
        deleted
            ? cn(
                "bg-muted/40 text-muted-foreground border border-dashed border-border/60 shadow-none",
                isMe ? "rounded-br-xs" : "rounded-bl-xs"
            )
            : isMe
                ? "bg-linear-to-br from-primary to-primary/90 text-primary-foreground rounded-br-xs shadow-primary/15"
                : "bg-muted/70 backdrop-blur-xl text-foreground rounded-bl-xs border border-border/40 shadow-slate-900/5"
    );

    return (
        <div
            data-message-id={message.id}
            className={cn("flex flex-col transition-all duration-150", isMe ? "items-end" : "items-start")}
        >
            <div
                ref={rootRef}
                className={cn("group/message relative max-w-[85%] md:max-w-[70%]", isEditing && "w-[85%] md:w-[70%]")}
            >
                {canInteract && (
                    <MessageToolbar
                        isMe={isMe}
                        visible={tapped || menuOpen}
                        disabled={isPending}
                        myReaction={myReaction}
                        canEdit={isMe && !!message.text}
                        canDelete={isMe}
                        onReact={handleReact}
                        onEdit={() => {
                            setTapped(false);
                            onStartEdit(message.id);
                        }}
                        onDelete={() => {
                            setTapped(false);
                            onRequestDelete(message);
                        }}
                        onMenuOpenChange={setMenuOpen}
                    />
                )}

                <div
                    className={bubbleClass}
                    aria-busy={isPending}
                    onPointerUp={(event) => {
                        // Mouse users get the hover toolbar; touch/pen users tap the bubble.
                        if (canInteract && event.pointerType !== "mouse") setTapped((value) => !value);
                    }}
                >
                    {deleted ? (
                        <p className="flex items-center gap-1.5 italic leading-relaxed text-[12px] md:text-[13px]">
                            <BanIcon className="h-3.5 w-3.5 shrink-0" />
                            {DELETED_MESSAGE_TEXT}
                        </p>
                    ) : (
                        <>
                            {hasAttachments && <Attachment attachments={message.attachments} isMe={isMe} />}

                            {isEditing ? (
                                <div className={cn(hasAttachments && "mt-2")}>
                                    <EditMessageForm
                                        initialText={message.text}
                                        saving={isPending}
                                        onSave={(text) => onSaveEdit(message.id, text)}
                                        onCancel={onCancelEdit}
                                    />
                                </div>
                            ) : (
                                message.text && (
                                    <p className={cn(
                                        "leading-relaxed tracking-tight text-[12px] md:text-[13px] whitespace-pre-wrap wrap-break-word",
                                        hasAttachments && "mt-2"
                                    )}>
                                        <HighlightedText text={message.text} ranges={highlights} />
                                    </p>
                                )
                            )}
                        </>
                    )}

                    {!isEditing && (
                        <div
                            className={cn(
                                "flex items-center justify-end gap-1 mt-1.5 text-[9px] select-none",
                                isMe && !deleted ? "text-primary-foreground/75" : "text-muted-foreground/70"
                            )}
                        >
                            {message.edited && (
                                <span title={message.editedAt ? `Edited ${message.editedAt.toLocaleString()}` : undefined}>
                                    (edited)
                                </span>
                            )}
                            <span>{message.time}</span>
                            {isMe && !deleted && (
                                <CheckCheck
                                    className={cn(
                                        "h-3 w-3 transition-colors",
                                        message.status === "read" ? "text-emerald-300 dark:text-emerald-400" : "opacity-60"
                                    )}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {!deleted && (
                <ReactionSummary
                    reactions={message.reactions}
                    currentUserId={currentUserId}
                    otherUserName={otherUserName}
                    isMe={isMe}
                    disabled={isPending}
                    onToggle={handleReact}
                />
            )}
        </div>
    );
});
