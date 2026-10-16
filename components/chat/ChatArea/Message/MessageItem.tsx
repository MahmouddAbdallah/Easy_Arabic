"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { BanIcon, CheckCheckIcon, CheckIcon } from "lucide-react";
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
    /** In a group: who wrote this message, shown above the first message of a run from somebody else. */
    senderName?: string;
    /** Which of the group's sender colours the name gets (0-7, see colorIndexOf). */
    senderTone?: number;
    /** In a group: how to name each person who reacted. */
    nameOfUser?: (userId: string) => string | undefined;
    /** Drawn joined to the message above it (same person, sent moments apart). */
    joinsPrevious?: boolean;
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
    /** This is the message the search just jumped to: its row glows for a moment so the eye finds it. */
    isFlashing?: boolean;
}

export const MessageItem = memo(function MessageItem({
    message,
    currentUserId,
    otherUserName,
    senderName,
    senderTone = 0,
    nameOfUser,
    joinsPrevious = false,
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
    const hasText = !!message.text;
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

    // The corner on the sender's side is tight at the bottom (it points at the sender) and, inside a burst, at the top too.
    const cornerClass = isMe
        ? cn("rounded-[18px] rounded-br-[6px]", joinsPrevious && "rounded-tr-[6px]")
        : cn("rounded-[18px] rounded-bl-[6px]", joinsPrevious && "rounded-tl-[6px]");

    const bubbleClass = cn(
        "relative flow-root px-3.5 py-2 text-[15px] leading-[1.5] transition-shadow",
        cornerClass,
        isFlashing && "chat-flash-bubble",
        deleted
            ? "border border-dashed border-(--chat-line-strong) bg-transparent text-(--chat-ink-3)"
            : isMe
              ? "bg-linear-to-br from-(--chat-out) to-(--chat-out-edge) text-(--chat-out-ink) shadow-(--chat-shadow-sm)"
              : "border border-(--chat-in-edge) bg-(--chat-in) text-(--chat-in-ink) shadow-(--chat-shadow-sm)"
    );

    const metaTone = isMe && !deleted ? "text-(--chat-out-meta)" : "text-(--chat-in-meta)";
    const StatusIcon = message.status === "sent" || !message.status ? CheckIcon : CheckCheckIcon;
    const meta = (
        <>
            {message.edited && (
                <span title={message.editedAt ? `Edited ${message.editedAt.toLocaleString()}` : undefined}>edited</span>
            )}
            <span className="tabular-nums">{message.time}</span>
            {isMe && !deleted && (
                <StatusIcon
                    aria-label={message.status === "read" ? "Read" : message.status === "delivered" ? "Delivered" : "Sent"}
                    className={cn("size-[15px] transition-colors", message.status === "read" ? "text-(--chat-read)" : "opacity-80")}
                />
            )}
        </>
    );
    // dir="ltr": the time reads "05:10 AM" even inside an Arabic message, whatever the direction of the text beside it.
    const metaClass = cn("inline-flex select-none items-center gap-1 whitespace-nowrap text-[11px] leading-none", metaTone);

    return (
        <div
            data-message-id={message.id}
            className={cn(
                "flex flex-col px-1",
                isMe ? "items-end" : "items-start",
                joinsPrevious ? "mt-0.5" : "mt-3",
                isFlashing && "chat-flash-row"
            )}
        >
            {senderName && !isMe && !joinsPrevious && (
                <p
                    dir="auto"
                    className="mb-1 max-w-[84%] truncate px-3 text-[12.5px] font-semibold sm:max-w-[74%] lg:max-w-[66%]"
                    style={{ color: `var(--chat-sender-${senderTone})` }}
                >
                    {senderName}
                </p>
            )}
            <div
                ref={rootRef}
                className={cn("group/message relative max-w-[84%] sm:max-w-[74%] lg:max-w-[66%]", isEditing && "w-[84%] sm:w-[74%] lg:w-[66%]")}
            >
                {canInteract && (
                    <MessageToolbar
                        isMe={isMe}
                        visible={tapped || menuOpen}
                        disabled={isPending}
                        myReaction={myReaction}
                        canEdit={isMe && hasText}
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
                        <p className="flex items-center gap-1.5 text-[14px] italic">
                            <BanIcon className="size-4 shrink-0" aria-hidden />
                            {DELETED_MESSAGE_TEXT}
                        </p>
                    ) : (
                        <>
                            {hasAttachments && (
                                <div className={cn("-mx-1.5 -mt-0.5", hasText || "mb-0.5")}>
                                    <Attachment attachments={message.attachments} isMe={isMe} />
                                </div>
                            )}

                            {isEditing ? (
                                <div className={cn(hasAttachments && "mt-2")}>
                                    <EditMessageForm
                                        initialText={message.text}
                                        saving={isPending}
                                        onSave={(text) => onSaveEdit(message.id, text)}
                                        onCancel={onCancelEdit}
                                    />
                                </div>
                            ) : hasText ? (
                                <p dir="auto" className={cn("whitespace-pre-wrap wrap-break-word", hasAttachments && "mt-1.5")}>
                                    <HighlightedText text={message.text} ranges={highlights} />
                                    {/* Floats to the end of the last line (the left end for Arabic) and drops to its own line only if it must. */}
                                    <span className="float-end ms-3 translate-y-[0.5em]">
                                        <span dir="ltr" className={metaClass}>
                                            {meta}
                                        </span>
                                    </span>
                                </p>
                            ) : null}
                        </>
                    )}

                    {!isEditing && (deleted || !hasText) && (
                        <div dir="ltr" className={cn(metaClass, "mt-1 flex justify-end")}>{meta}</div>
                    )}
                </div>
            </div>

            {!deleted && (
                <ReactionSummary
                    reactions={message.reactions}
                    currentUserId={currentUserId}
                    otherUserName={otherUserName}
                    nameOfUser={nameOfUser}
                    isMe={isMe}
                    disabled={isPending}
                    onToggle={handleReact}
                />
            )}
        </div>
    );
});
