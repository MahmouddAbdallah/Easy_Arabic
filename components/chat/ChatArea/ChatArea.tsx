"use client";

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import toast from "react-hot-toast";
import { ArrowDown, ChevronUpIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import InputMessage from "./InputMessage";
import { useChat } from "../ChatProvider";
import { useAppContext } from "@/components/AppContext";
import ChatHeader from "./ChatHeader";
import { DateSeparator } from "./DateSeparator";
import { MessageItem } from "./Message/MessageItem";
import { CallLogMessage } from "../Call/CallLogMessage";
import { DeleteMessageDialog } from "./Message/DeleteMessageDialog";
import { useMessageActions } from "../hooks/useMessageActions";
import { useMarkChatRead } from "../hooks/useMarkChatRead";
import { useChatMessages } from "../hooks/useChatMessages";
import { useChatSearch } from "../hooks/useChatSearch";
import { ChatSearchPanel } from "./Search/ChatSearchPanel";
import { ChatSearchNavigator } from "./Search/ChatSearchNavigator";
import { useToday } from "../hooks/useToday";
import { withDaySeparators } from "../lib/dateSeparators";
import type { ChatSearchResult } from "../lib/chatSearch";
import type { MessageType } from "../types";

/** How long the message a search jumped to keeps its ring. */
const FLASH_MS = 2200;
/** Closer to the bottom than this counts as "at the latest messages". */
const NEAR_BOTTOM_PX = 150;
/** Further from the bottom than this (after a search jump), the "jump to latest" button shows. */
const JUMP_LATEST_PX = 400;

/**
 * Scrolls `viewport` so `element` sits in the middle (a message taller than the screen is lined up by its
 * top instead, so you see where it begins). A short hop is animated; a long one (months of history away)
 * is instant, because scrolling past thousands of pixels slowly just looks broken.
 */
function scrollMessageIntoView(viewport: HTMLElement, element: HTMLElement) {
    const viewportRect = viewport.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const elementTop = viewport.scrollTop + (elementRect.top - viewportRect.top);

    const top =
        elementRect.height >= viewport.clientHeight
            ? elementTop - 16
            : elementTop - (viewport.clientHeight - elementRect.height) / 2;

    const isShortHop = Math.abs(top - viewport.scrollTop) < viewport.clientHeight * 1.5;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    viewport.scrollTo({ top: Math.max(0, top), behavior: isShortHop && !reduceMotion ? "smooth" : "auto" });
}

export function ChatArea() {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<MessageType | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    // Phones: the results list covers the chat until a result is chosen (then the navigator bar takes over).
    const [listVisible, setListVisible] = useState(true);
    // The message a search jump should scroll to once it is on screen / the one that is ringed right now.
    const [jumpRequest, setJumpRequest] = useState<{ id: string; key: number } | null>(null);
    const [flash, setFlash] = useState<{ id: string; key: number } | null>(null);
    const [jumping, setJumping] = useState(false);
    // A search jump left the reader somewhere in the past (shows "jump to latest" and stops new messages pulling them away).
    const [awayFromLatest, setAwayFromLatest] = useState(false);
    const { receiver, receiverId, chatId, conversation } = useChat();
    const { user } = useAppContext();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    // How far the reader is from the bottom, captured right before older messages are added above.
    const keepScrollRef = useRef<number | null>(null);
    // The same "away" fact for code that must not wait for a render (the new-message scroll below).
    const awayRef = useRef(false);
    // Numbers each jump, so an answer for a jump that has been replaced (or a chat that was left) is ignored.
    const jumpKeyRef = useRef(0);
    const searchButtonRef = useRef<HTMLButtonElement>(null);

    const currentUserId = user?.id;
    // Who "Call back" rings. `receiver` lags behind `receiverId` while a different chat is loading.
    const peer = receiverId && receiver?.id === receiverId ? { id: receiverId, name: receiver.name ?? "User" } : null;
    // The latest page of the conversation, kept live; older pages are added with `loadMore`.
    // Nothing is read before the chat document says where this user's history starts ("Clear chat" moves it).
    const { messages, loading, hasMore, loadingMore, loadMore, loadUntil } = useChatMessages(chatId, currentUserId, {
        enabled: conversation.ready,
        clearedAt: conversation.clearedAt,
    });
    // When the newest message on screen was sent: "Clear chat" / "Delete chat" stop exactly there.
    const newestMessageAt = messages[messages.length - 1]?.sentAt?.toISOString() ?? null;
    const search = useChatSearch({ chatId, receiverId, enabled: searchOpen });
    const { select: selectResult, step: stepResult } = search;
    // The current day, so "Today" turns into "Yesterday" by itself if the chat stays open past midnight.
    const today = useToday();
    // The conversation with a date separator before the first message of each calendar day.
    const timeline = useMemo(() => withDaySeparators(messages, today), [messages, today]);
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

        // Search belongs to the chat it was opened in.
        jumpKeyRef.current += 1;
        awayRef.current = false;
        setSearchOpen(false);
        setListVisible(true);
        setJumpRequest(null);
        setFlash(null);
        setJumping(false);
        setAwayFromLatest(false);
    }, [chatId, currentUserId]);

    // Only follow the conversation when its newest message changes. Reacting to, editing or
    // deleting an older message must not yank the reader to the bottom.
    const lastMessage = messages[messages.length - 1];
    const lastMessageId = lastMessage?.id;
    useEffect(() => {
        // After a search jump the reader is deliberately somewhere in the past: a message from the other
        // person must not drag them away from it. Sending one of their own still takes them to the bottom.
        if (awayRef.current && lastMessage && !lastMessage.isMe) return;
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

    // Stable between renders so the memoised MessageItem rows don't re-render on every keystroke in the search box.
    const handleSaveEdit = useCallback(
        async (messageId: string, text: string) => {
            const ok = await editMessage(messageId, text);
            if (ok) setEditingId((current) => (current === messageId ? null : current));
        },
        [editMessage]
    );
    const handleCancelEdit = useCallback(() => setEditingId(null), []);

    // ---- In-chat search -------------------------------------------------------------------------------

    const openSearch = () => {
        setListVisible(true);
        setSearchOpen(true);
    };

    const closeSearch = useCallback(() => {
        setSearchOpen(false);
        setListVisible(true);
        searchButtonRef.current?.focus();
    }, []);

    /**
     * Brings a search result into view: loads the history down to it when it is older than what is on
     * screen (the hook reads only the messages in between), then the effect below scrolls to it.
     */
    const jumpToMessage = useCallback(
        async (target: Pick<ChatSearchResult, "id" | "time">) => {
            const key = ++jumpKeyRef.current;
            setJumping(true);

            const reached = await loadUntil(target);
            if (key !== jumpKeyRef.current) return; // another jump (or another chat) took over

            setJumping(false);
            if (!reached) {
                // Same id as the hook's own load error: a failed load shows one toast, not two.
                toast.error("Couldn't open that message. Please try again.", { id: "chat-load-older-error" });
                return;
            }
            setJumpRequest({ id: target.id, key });
        },
        [loadUntil]
    );

    const handleSelectResult = useCallback(
        (result: ChatSearchResult) => {
            selectResult(result.id);
            setListVisible(false);
            void jumpToMessage(result);
        },
        [selectResult, jumpToMessage]
    );

    const handleStepResult = useCallback(
        async (direction: "older" | "newer") => {
            const result = await stepResult(direction);
            if (result) void jumpToMessage(result);
        },
        [stepResult, jumpToMessage]
    );

    // Once the target is in the DOM (it may only just have been loaded), scroll to it and ring it. Runs again
    // on every timeline change until the message shows up, so it doesn't matter which render brings it.
    useLayoutEffect(() => {
        if (!jumpRequest) return;
        const viewport = getScrollViewport();
        const element = contentRef.current?.querySelector<HTMLElement>(
            `[data-message-id="${CSS.escape(jumpRequest.id)}"]`
        );
        if (!viewport || !element) return;

        awayRef.current = true;
        scrollMessageIntoView(viewport, element);
        setFlash(jumpRequest);
        setJumpRequest(null);
    }, [jumpRequest, timeline]);

    useEffect(() => {
        if (!flash) return;
        const timer = setTimeout(() => setFlash(null), FLASH_MS);
        return () => clearTimeout(timer);
    }, [flash]);

    // Tracks how far the reader is from the latest message, for the "jump to latest" button.
    useEffect(() => {
        const viewport = contentRef.current?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
        if (!viewport) return;

        const onScroll = () => {
            const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
            // Back at the bottom: the reader is following the conversation again.
            if (distance < NEAR_BOTTOM_PX) awayRef.current = false;
            setAwayFromLatest(awayRef.current && distance > JUMP_LATEST_PX);
        };
        viewport.addEventListener("scroll", onScroll, { passive: true });
        return () => viewport.removeEventListener("scroll", onScroll);
    }, [chatId]);

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        const ok = await deleteMessage(deleteTarget.id);
        if (ok) setDeleteTarget(null);
    };

    return (
        <div className="flex-1 flex h-full bg-background/30 backdrop-blur-3xl relative select-none min-w-0 overflow-hidden">
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                <ChatHeader
                    searchOpen={searchOpen}
                    onToggleSearch={searchOpen ? closeSearch : openSearch}
                    searchButtonRef={searchButtonRef}
                    canClear={messages.length > 0}
                    newestMessageAt={newestMessageAt}
                />

                <div className="relative flex min-h-0 flex-1 flex-col">
                    <ScrollArea className="flex-1 min-h-0 px-2 md:px-6">
                        <div ref={contentRef} className="space-y-6 max-w-full mx-auto py-6">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-2 text-xs text-muted-foreground/80">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                    <span>Loading messages...</span>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center text-xs text-muted-foreground/80">
                                    <p className="font-medium">No messages yet.</p>
                                    <p className="text-[11px] opacity-70">
                                        {conversation.blocked
                                            ? "Messages and calls are unavailable in this conversation."
                                            : "Send a message to start the conversation!"}
                                    </p>
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

                                    {timeline.map((item) => item.type === "separator" ? (
                                        <DateSeparator key={item.key} label={item.label} title={item.title} dateTime={item.dateTime} />
                                    ) : item.message.call ? (
                                        <CallLogMessage key={item.message.id} message={item.message} peer={peer} />
                                    ) : (
                                        <MessageItem
                                            key={item.message.id}
                                            message={item.message}
                                            currentUserId={currentUserId ?? ""}
                                            otherUserName={receiver?.name}
                                            isEditing={editingId === item.message.id && !item.message.deleted}
                                            isPending={isPending(item.message.id)}
                                            onReact={reactToMessage}
                                            onStartEdit={setEditingId}
                                            onCancelEdit={handleCancelEdit}
                                            onSaveEdit={handleSaveEdit}
                                            onRequestDelete={setDeleteTarget}
                                            highlightTerms={search.terms}
                                            isFlashing={flash?.id === item.message.id}
                                        />
                                    ))}
                                </>
                            )}

                            <div ref={messagesEndRef} />
                        </div>
                    </ScrollArea>

                    {jumping && (
                        <div role="status" className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
                            <span className="flex items-center gap-2 rounded-full border border-border/50 bg-card/90 px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-md backdrop-blur-md animate-in fade-in-0 slide-in-from-top-2">
                                <Loader2Icon className="size-3.5 animate-spin text-primary" aria-hidden />
                                Loading messages...
                            </span>
                        </div>
                    )}

                    {awayFromLatest && (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Jump to latest messages"
                            title="Jump to latest messages"
                            onClick={scrollToBottom}
                            className="absolute bottom-4 end-5 z-10 size-10 rounded-full shadow-lg animate-in fade-in-0 zoom-in-90"
                        >
                            <ArrowDown className="size-4" aria-hidden />
                        </Button>
                    )}
                </div>

                {searchOpen && !listVisible && (
                    <ChatSearchNavigator
                        search={search}
                        onStep={handleStepResult}
                        onShowList={() => setListVisible(true)}
                        onClose={closeSearch}
                    />
                )}

                <InputMessage />

                <DeleteMessageDialog
                    open={!!deleteTarget}
                    deleting={!!deleteTarget && isPending(deleteTarget.id)}
                    onConfirm={handleConfirmDelete}
                    onClose={() => setDeleteTarget(null)}
                />
            </div>

            {searchOpen && (
                <ChatSearchPanel
                    search={search}
                    me={{ id: user?.id, name: user?.name, imageUrl: user?.imageUrl }}
                    other={{ id: receiver?.id, name: receiver?.name, imageUrl: receiver?.imageUrl }}
                    listVisible={listVisible}
                    onSelect={handleSelectResult}
                    onStep={handleStepResult}
                    onClose={closeSearch}
                />
            )}
        </div>
    );
}
