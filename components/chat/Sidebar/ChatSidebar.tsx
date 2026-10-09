"use client";

import { MoreVertical, SettingsIcon, Sparkles, UserIcon, } from "lucide-react";
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
import { isChatClearedFor, isChatHiddenFor } from "../lib/chatState";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
            {/* 1. Header */}
            <div className="h-16 px-4 border-b border-border/30 flex items-center justify-between bg-card/20 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="relative group cursor-pointer">
                        <div className="absolute -inset-0.5 bg-linear-to-r from-primary to-purple-600 rounded-full blur opacity-40 group-hover:opacity-75 transition duration-300" />
                        <Avatar className="h-9 w-9 relative ring-1 ring-background/80 shadow-md">
                            <AvatarImage
                                src={user?.imageUrl || user?.name || ''}
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
                <DropdownMenu>
                    <DropdownMenuTrigger
                        className="h-8 w-8 flex justify-center cursor-pointer items-center text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-all"
                    >
                        <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        className="w-52 rounded-xl backdrop-blur-lg border-border/50"
                    >
                        <DropdownMenuItem className="gap-2.5 text-xs font-medium cursor-pointer rounded-lg">
                            <UserIcon className="h-3.5 w-3.5 text-muted-foreground" /> Profile
                            Info
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2.5 text-xs font-medium cursor-pointer rounded-lg">
                            <SettingsIcon className="h-3.5 w-3.5 text-muted-foreground" /> App
                            Preferences
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

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