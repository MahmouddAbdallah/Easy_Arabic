"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { ChevronUpIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import InputMessage from "./InputMessage";
import { useChat } from "../ChatProvider";
import { useAppContext } from "@/components/AppContext";
import ChatHeader from "./ChatHeader";
import { MessageItem } from "./Message/MessageItem";
import { CallLogMessage } from "../Call/CallLogMessage";
import { DeleteMessageDialog } from "./Message/DeleteMessageDialog";
import { useMessageActions } from "../hooks/useMessageActions";
import { useMarkChatRead } from "../hooks/useMarkChatRead";
import { useChatMessages } from "../hooks/useChatMessages";
import type { MessageType } from "../types";

export function ChatArea() {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<MessageType | null>(null);
    const { receiver, receiverId, chatId } = useChat();
    const { user } = useAppContext();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    // How far the reader is from the bottom, captured right before older messages are added above.
    const keepScrollRef = useRef<number | null>(null);

    const currentUserId = user?.id;
    // Who "Call back" rings. `receiver` lags behind `receiverId` while a different chat is loading.
    const peer = receiverId && receiver?.id === receiverId ? { id: receiverId, name: receiver.name ?? "User" } : null;
    // The latest page of the conversation, kept live; older pages are added with `loadMore`.
    const { messages, loading, hasMore, loadingMore, loadMore } = useChatMessages(chatId, currentUserId);
    const { editMessage, deleteMessage, reactToMessage, isPending } = useMessageActions(chatId);
    // Opening the chat (and keeping it open) clears the current user's own unread counter.
    useMarkChatRead(chatId, currentUserId);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView();
    };

    useEffect(() => {
        if (!chatId || !currentUserId) return;

        setEditingId(null);
        setDeleteTarget(null);
        keepScrollRef.current = null;
    }, [chatId, currentUserId]);

    // Only follow the conversation when its newest message changes. Reacting to, editing or
    // deleting an older message must not yank the reader to the bottom.
    const lastMessageId = messages[messages.length - 1]?.id;
    useEffect(() => {
        scrollToBottom();
    }, [lastMessageId]);

    // The element that actually scrolls is the ScrollArea's viewport, which wraps `contentRef`.
    const getScrollViewport = () => contentRef.current?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]') ?? null;

    const handleLoadMore = async () => {
        if (loadingMore || !hasMore) return;

        const viewport = getScrollViewport();
        if (viewport) keepScrollRef.current = viewport.scrollHeight - viewport.scrollTop;
        const added = await loadMore();
        // Nothing was added above (failed, or no older messages), so there is no position to restore.
        if (!added) keepScrollRef.current = null;
    };

    // Older messages are inserted ABOVE what the reader is looking at, which would push it down and
    // make the chat jump. Right after they are in the DOM (and before the browser paints) put the
    // viewport back at the same distance from the bottom, so the same messages stay where they were.
    // This sets an absolute position, so it also holds in browsers that adjust the scroll themselves.
    const firstMessageId = messages[0]?.id;
    useLayoutEffect(() => {
        const distanceFromBottom = keepScrollRef.current;
        if (distanceFromBottom === null) return;
        keepScrollRef.current = null;

        const viewport = getScrollViewport();
        if (viewport) viewport.scrollTop = viewport.scrollHeight - distanceFromBottom;
    }, [firstMessageId]);

    const handleSaveEdit = async (messageId: string, text: string) => {
        const ok = await editMessage(messageId, text);
        if (ok) setEditingId((current) => (current === messageId ? null : current));
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        const ok = await deleteMessage(deleteTarget.id);
        if (ok) setDeleteTarget(null);
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background/30 backdrop-blur-3xl relative select-none min-w-0 overflow-hidden">
            <ChatHeader />

            <ScrollArea className="flex-1 min-h-0 px-2 md:px-6">
                <div ref={contentRef} className="space-y-6 max-w-full mx-auto py-6">
                    <div className="flex items-center justify-center my-4">
                        <span className="text-[10px] font-semibold tracking-wide text-muted-foreground/70 bg-muted/40 px-3.5 py-1 rounded-full border border-border/30 backdrop-blur-md shadow-xs">
                            Today
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-xs text-muted-foreground/80">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            <span>Loading messages...</span>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center text-xs text-muted-foreground/80">
                            <p className="font-medium">No messages yet.</p>
                            <p className="text-[11px] opacity-70">Send a message to start the conversation!</p>
                        </div>
                    ) : (
                        <>
                            {hasMore && (
                                <div className="flex items-center justify-center">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="rounded-full text-xs text-muted-foreground"
                                        onClick={handleLoadMore}
                                        disabled={loadingMore}
                                        aria-busy={loadingMore}
                                    >
                                        {loadingMore ? (
                                            <>
                                                <Loader2Icon className="animate-spin" />
                                                Loading...
                                            </>
                                        ) : (
                                            <>
                                                <ChevronUpIcon />
                                                Load more
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}

                            {messages.map((msg) => msg.call ? (
                                <CallLogMessage key={msg.id} message={msg} peer={peer} />
                            ) : (
                                <MessageItem
                                    key={msg.id}
                                    message={msg}
                                    currentUserId={currentUserId ?? ""}
                                    otherUserName={receiver?.name}
                                    isEditing={editingId === msg.id && !msg.deleted}
                                    isPending={isPending(msg.id)}
                                    onReact={reactToMessage}
                                    onStartEdit={setEditingId}
                                    onCancelEdit={() => setEditingId(null)}
                                    onSaveEdit={handleSaveEdit}
                                    onRequestDelete={setDeleteTarget}
                                />
                            ))}
                        </>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </ScrollArea>
            <InputMessage />

            <DeleteMessageDialog
                open={!!deleteTarget}
                deleting={!!deleteTarget && isPending(deleteTarget.id)}
                onConfirm={handleConfirmDelete}
                onClose={() => setDeleteTarget(null)}
            />
        </div>
    );
}
