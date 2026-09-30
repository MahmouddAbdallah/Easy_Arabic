"use client";

import { Sparkles, } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import SearchPeople from "./SearchPeople";
import { useChat } from "../ChatProvider";
import { useEffect, useState } from "react";
import { useAppContext } from "@/components/AppContext";
import { collection, onSnapshot, orderBy, query, Timestamp, where } from "firebase/firestore";
import { firebaseClientDB } from "@/lib/config/firebase-client";
import ReceiverInfo from "./ReceiverInfo";
import { getUnreadCount, type UnreadCount } from "../lib/unread";
import Link from "next/link";

export interface ChatItemType {
    id: string;
    lastMessage: string;
    /** Per-user counters ({ [userId]: number }); old chats still hold one shared number. Read it with getUnreadCount(). */
    unreadCount?: UnreadCount;
    isRead?: boolean;
    updatedAt?: Timestamp;
    participants: string[]
    category?: "direct" | "group";
}

export function ChatSidebar() {
    const [chats, setChats] = useState<ChatItemType[] | null>(null);

    const { receiverId } = useChat();
    const { user } = useAppContext();

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
            {/* 1. Header */}
            <div className="h-16 px-4 border-b border-border/30 flex items-center justify-between bg-card/20 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="relative group cursor-pointer">
                        <div className="absolute -inset-0.5 bg-linear-to-r from-primary to-purple-600 rounded-full blur opacity-40 group-hover:opacity-75 transition duration-300" />
                        <Avatar className="h-9 w-9 relative ring-1 ring-background/80 shadow-md">
                            <AvatarImage
                                src={user?.name || user?.name || ''}
                                alt={user?.name || 'User Avatar'}
                            />
                            <AvatarFallback className="text-xs font-semibold bg-muted">
                                {user?.name?.slice(0, 2) || 'CN'}

                            </AvatarFallback>
                        </Avatar>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-background shadow-sm" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-semibold text-sm tracking-tight flex items-center gap-1.5">
                            {user?.name}
                            <Sparkles className="h-3 w-3 text-primary fill-primary/20" />
                        </span>
                        <span className="text-[11px] text-muted-foreground/80 font-medium">
                            Available
                        </span>
                    </div>
                </div>
            </div>

            {/* 2. Search & Filters */}
            <SearchPeople />

            {/* 3. Chat List */}
            <ScrollArea className="flex-1 px-2">
                <div className="space-y-1 py-1">
                    {chats?.map((chat) => {
                        const receiveId = chat.participants.find(id => id != user?.id as string) ?? '';
                        const isSelected = receiveId == receiverId;
                        return (
                            <Link
                                key={chat?.id}
                                href={`/chat?receiverId=${receiveId}`}
                            >
                                <ReceiverInfo
                                    receiverId={receiveId as string}
                                    lastSend={chat?.updatedAt as Timestamp}
                                    message={chat?.lastMessage}
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