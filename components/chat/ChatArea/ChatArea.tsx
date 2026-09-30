"use client";

import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import InputMessage from "./InputMessage";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { useChat } from "../ChatProvider";
import { useAppContext } from "@/components/AppContext";
import { firebaseClientDB } from "@/lib/config/firebase-client";
import ChatHeader from "./ChatHeader";
import { MessageItem } from "./Message/MessageItem";
import { DeleteMessageDialog } from "./Message/DeleteMessageDialog";
import { useMessageActions } from "../hooks/useMessageActions";
import { mapMessageDoc } from "../lib/mapMessage";
import type { MessageType } from "../types";

function generateChatId(id1: string, id2: string): string {
    return [id1, id2].sort().join("_");
}

export function ChatArea() {
    const [messages, setMessages] = useState<MessageType[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<MessageType | null>(null);
    const { receiverId, receiver } = useChat();
    const { user } = useAppContext();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const currentUserId = user?.id;
    const chatId = currentUserId && receiverId ? generateChatId(currentUserId, receiverId) : null;
    const { editMessage, deleteMessage, reactToMessage, isPending } = useMessageActions(chatId);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (!chatId || !currentUserId) return;

        setLoading(true);
        setEditingId(null);
        setDeleteTarget(null);
        const messagesRef = collection(firebaseClientDB, "chats", chatId, "messages");
        const q = query(messagesRef, orderBy("time", "asc"));
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                // Edits, deletions and reactions arrive here too, so both users see them in real time.
                setMessages(snapshot.docs.map((docSnap) => mapMessageDoc(docSnap.id, docSnap.data(), currentUserId)));
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching realtime messages: ", error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [chatId, currentUserId]);

    // Only follow the conversation when its newest message changes. Reacting to, editing or
    // deleting an older message must not yank the reader to the bottom.
    const lastMessageId = messages[messages.length - 1]?.id;
    useEffect(() => {
        scrollToBottom();
    }, [lastMessageId]);

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
                <div className="space-y-6 max-w-full mx-auto py-6">
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
                        messages.map((msg) => (
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
                        ))
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
