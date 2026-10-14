"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import InputMessage from "./InputMessage";
import { useChat } from "../ChatProvider";
import { useAppContext } from "@/components/AppContext";
import ChatHeader from "./ChatHeader";
import { MessageList } from "./MessageList";
import { DeleteMessageDialog } from "./Message/DeleteMessageDialog";
import { useMessageActions } from "../hooks/useMessageActions";
import { useMarkChatRead } from "../hooks/useMarkChatRead";
import { useChatMessages } from "../hooks/useChatMessages";
import { useChatScroll } from "../hooks/useChatScroll";
import { useChatSearch } from "../hooks/useChatSearch";
import { ChatSearchPanel } from "./Search/ChatSearchPanel";
import { ChatSearchNavigator } from "./Search/ChatSearchNavigator";
import type { ChatSearchResult } from "../lib/chatSearch";
import type { MessageType } from "../types";

export function ChatArea() {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<MessageType | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    // Phones: the results list covers the chat until a result is chosen (then the navigator bar takes over).
    const [listVisible, setListVisible] = useState(true);
    const { receiver, receiverId, chatId, conversation } = useChat();
    const { user } = useAppContext();
    const searchButtonRef = useRef<HTMLButtonElement>(null);

    const currentUserId = user?.id;
    // Who "Call back" rings. `receiver` lags behind `receiverId` while a different chat is loading.
    const peer = receiverId && receiver?.id === receiverId ? { id: receiverId, name: receiver.name ?? "User" } : null;

    // The conversation, kept live. Nothing is read before the chat document says where this user's history
    // starts ("Clear chat" moves it). Older history, newer history after a jump, and the jump itself are all here.
    const chat = useChatMessages(chatId, currentUserId, {
        enabled: conversation.ready,
        clearedAt: conversation.clearedAt,
    });
    const { messages, latest } = chat;
    // When the newest message OF THE CONVERSATION was sent ("Clear chat" / "Delete chat" stop exactly there): the
    // live end, which is not what is on screen while the reader is looking at a window of the past.
    const newestMessageAt = latest?.sentAt?.toISOString() ?? null;

    const search = useChatSearch({ chatId, receiverId, enabled: searchOpen });
    const { select: selectResult, step: stepResult } = search;
    const { editMessage, deleteMessage, reactToMessage, isPending } = useMessageActions(chatId);
    // Opening the chat (and keeping it open) clears the current user's own unread counter.
    useMarkChatRead(chatId, currentUserId);

    const scroll = useChatScroll({
        chatId,
        messages,
        loading: chat.loading,
        detached: chat.detached,
        latest,
        hasOlder: chat.hasOlder,
        hasNewer: chat.hasNewer,
        loadingOlder: chat.loadingOlder,
        loadingNewer: chat.loadingNewer,
        loadOlder: chat.loadOlder,
        loadNewer: chat.loadNewer,
        reveal: chat.reveal,
        returnToLatest: chat.returnToLatest,
    });
    const { jumpTo } = scroll;

    useEffect(() => {
        if (!chatId || !currentUserId) return;
        setEditingId(null);
        setDeleteTarget(null);
        // Search belongs to the chat it was opened in.
        setSearchOpen(false);
        setListVisible(true);
    }, [chatId, currentUserId]);

    // Stable between renders so the memoised MessageItem rows don't re-render on every keystroke in the search box.
    const handleSaveEdit = useCallback(
        async (messageId: string, text: string) => {
            const ok = await editMessage(messageId, text);
            if (ok) setEditingId((current) => (current === messageId ? null : current));
        },
        [editMessage]
    );
    const handleCancelEdit = useCallback(() => setEditingId(null), []);
    const handleLoadOlder = useCallback(() => void chat.loadOlder(), [chat.loadOlder]);
    const handleLoadNewer = useCallback(() => void chat.loadNewer(), [chat.loadNewer]);
    const handleReload = useCallback(() => void chat.reload(), [chat.reload]);

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

    // Choosing a result brings that message on screen, however far back it is, scrolls to it and flashes it.
    const handleSelectResult = useCallback(
        (result: ChatSearchResult) => {
            selectResult(result.id);
            setListVisible(false);
            void jumpTo(result);
        },
        [selectResult, jumpTo]
    );

    const handleStepResult = useCallback(
        async (direction: "older" | "newer") => {
            const result = await stepResult(direction);
            if (result) void jumpTo(result);
        },
        [stepResult, jumpTo]
    );

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        const ok = await deleteMessage(deleteTarget.id);
        if (ok) setDeleteTarget(null);
    };

    return (
        <div className="relative flex h-full min-w-0 flex-1 overflow-hidden bg-(--chat-canvas)">
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                <ChatHeader
                    searchOpen={searchOpen}
                    onToggleSearch={searchOpen ? closeSearch : openSearch}
                    searchButtonRef={searchButtonRef}
                    canClear={messages.length > 0}
                    newestMessageAt={newestMessageAt}
                />

                <MessageList
                    messages={messages}
                    loading={chat.loading}
                    failed={chat.failed}
                    hasOlder={chat.hasOlder}
                    hasNewer={chat.hasNewer}
                    loadingOlder={chat.loadingOlder}
                    loadingNewer={chat.loadingNewer}
                    detached={chat.detached}
                    onLoadOlder={handleLoadOlder}
                    onLoadNewer={handleLoadNewer}
                    onReload={handleReload}
                    scrollerRef={scroll.scrollerRef}
                    contentRef={scroll.contentRef}
                    topSentinelRef={scroll.topSentinelRef}
                    bottomSentinelRef={scroll.bottomSentinelRef}
                    jumping={scroll.jumping}
                    flashId={scroll.flashId}
                    showLatest={scroll.showLatest}
                    onGoToLatest={scroll.goToLatest}
                    currentUserId={currentUserId ?? ""}
                    otherUserName={receiver?.name}
                    peer={peer}
                    blocked={conversation.blocked}
                    editingId={editingId}
                    isPending={isPending}
                    onReact={reactToMessage}
                    onStartEdit={setEditingId}
                    onCancelEdit={handleCancelEdit}
                    onSaveEdit={handleSaveEdit}
                    onRequestDelete={setDeleteTarget}
                    highlightTerms={search.terms}
                />

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
