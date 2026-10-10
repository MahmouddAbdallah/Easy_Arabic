"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import SearchPeople from "./SearchPeople";
import { SidebarHeader } from "./SidebarHeader";
import { useChat } from "../ChatProvider";
import { useEffect, useState } from "react";
import { useAppContext } from "@/components/AppContext";
import { collection, onSnapshot, orderBy, query, Timestamp, where } from "firebase/firestore";
import { firebaseClientDB } from "@/lib/config/firebase-client";
import ReceiverInfo from "./ReceiverInfo";
import { getUnreadCount, type UnreadCount } from "../lib/unread";
import { isChatClearedFor, isChatHiddenFor } from "../lib/chatState";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface ChatItemType {
    id: string;
    lastMessage: string;
    /** Per-user counters ({ [userId]: number }); old chats still hold one shared number. Read it with getUnreadCount(). */
    unreadCount?: UnreadCount;
    isRead?: boolean;
    updatedAt?: Timestamp;
    participants: string[]
    category?: "direct" | "group";
    /** ISO time of the newest message or call entry; what "clear" and "delete" are compared against. */
    time?: string;
    /** Per-user state of the conversation, { [userId]: ISO time } (see lib/chatState.ts). */
    clearedAt?: Record<string, string>;
    deletedAt?: Record<string, string>;
    blocks?: Record<string, string>;
}

export function ChatSidebar() {
    const [chats, setChats] = useState<ChatItemType[] | null>(null);

    const { receiverId, locallyDeleted } = useChat();
    const { user } = useAppContext();
    const pathname = usePathname();

    useEffect(() => {
        if (!user?.id) return;
        const q = query(
            collection(firebaseClientDB, 'chats'),
            orderBy('updatedAt', 'desc'),
            where('participants', 'array-contains', user.id)
        );
        return onSnapshot(q, (snap) => {
            setChats(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatItemType)));
        });
    }, [user?.id]);

    return (
        <aside className="w-full border-r border-border/40 h-full flex flex-col bg-background/60 backdrop-blur-2xl select-none shrink-0 transition-all">
            {/* 1. Header: profile, presence and menu (see SidebarHeader) */}
            <SidebarHeader />

            {/* 2. Search & Filters */}
            <SearchPeople />

            {/* 3. Chat List */}
            <ScrollArea className="flex-1 px-2">
                <div className="space-y-1 py-1">
                    {chats?.map((chat) => {
                        // A deleted chat stays out of the list until something newer than the deletion arrives.
                        // `locallyDeleted` is this browser's own deletion, applied before Firestore reports it.
                        if (isChatHiddenFor(chat, user?.id, locallyDeleted[chat.id])) return null;
                        // Everything in it was cleared: nothing to preview (the other person's list is untouched).
                        const cleared = isChatClearedFor(chat, user?.id);
                        const receiveId = chat.participants.find(id => id != user?.id as string) ?? '';
                        const isSelected = receiveId == receiverId;
                        return (
                            <Link
                                key={chat?.id}
                                href={`${pathname}?receiverId=${receiveId}`}
                            >
                                <ReceiverInfo
                                    receiverId={receiveId as string}
                                    lastSend={cleared ? undefined : chat?.updatedAt as Timestamp}
                                    message={cleared ? '' : chat?.lastMessage}
                                    isSelected={isSelected}
                                    unreadCount={getUnreadCount(chat?.unreadCount, user?.id)}
                                />
                            </Link>
                        );
                    })}
                </div>
            </ScrollArea>
        </aside>
    );
}