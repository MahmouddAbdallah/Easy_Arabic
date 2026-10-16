"use client";

import SearchPeople from "./SearchPeople";
import { SidebarHeader } from "./SidebarHeader";
import { useChat } from "../ChatProvider";
import { useEffect, useMemo, useState } from "react";
import { useAppContext } from "@/components/AppContext";
import { collection, onSnapshot, orderBy, query, Timestamp, where } from "firebase/firestore";
import { firebaseClientDB } from "@/lib/config/firebase-client";
import ReceiverInfo from "./ReceiverInfo";
import GroupRow from "./GroupRow";
import { getGroupPreview } from "../lib/groups";
import { getUnreadCount, type UnreadCount } from "../lib/unread";
import { isChatClearedFor, isChatHiddenFor } from "../lib/chatState";
import { useToday } from "../hooks/useToday";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircleIcon } from "lucide-react";

export interface ChatItemType {
    id: string;
    lastMessage: string;
    /** Per-user counters ({ [userId]: number }); old chats still hold one shared number. Read it with getUnreadCount(). */
    unreadCount?: UnreadCount;
    isRead?: boolean;
    updatedAt?: Timestamp;
    participants: string[]
    category?: "direct" | "group";
    /** Groups only (see lib/groups.ts for the document): the name, picture, who made it and who is in it. */
    name?: string;
    imageUrl?: string;
    createdBy?: string;
    /** Who wrote `lastMessage` (a group's preview says so). */
    lastSenderId?: string;
    members?: Record<string, { name?: string; role?: string; imageUrl?: string }>;
    /** ISO time of the newest message or call entry; what "clear" and "delete" are compared against. */
    time?: string;
    /** Per-user state of the conversation, { [userId]: ISO time } (see lib/chatState.ts). */
    clearedAt?: Record<string, string>;
    deletedAt?: Record<string, string>;
    blocks?: Record<string, string>;
}

function ListSkeleton() {
    return (
        <div role="status" aria-label="Loading conversations" className="space-y-0.5 px-1 pt-1">
            {Array.from({ length: 7 }, (_, index) => (
                <div key={index} className="flex items-center gap-3.5 rounded-2xl p-3">
                    <div className="chat-skeleton size-[52px] shrink-0 rounded-full" />
                    <div className="flex flex-1 flex-col gap-2.5">
                        <div className="flex justify-between gap-6">
                            <div className="chat-skeleton h-3.5 w-28 rounded-md" />
                            <div className="chat-skeleton h-3 w-10 rounded-md" />
                        </div>
                        <div className="chat-skeleton h-3 w-3/4 rounded-md" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function ChatSidebar() {
    const [chats, setChats] = useState<ChatItemType[] | null>(null);

    const { receiverId, groupId, locallyDeleted } = useChat();
    const { user } = useAppContext();
    const pathname = usePathname();
    // One clock for every row, so the times turn "Today" into "Yesterday" together after midnight.
    const today = useToday();

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

    // A deleted chat stays out of the list until something newer than the deletion arrives.
    // `locallyDeleted` is this browser's own deletion, applied before Firestore reports it.
    const visible = useMemo(
        () => chats?.filter((chat) => !isChatHiddenFor(chat, user?.id, locallyDeleted[chat.id])) ?? null,
        [chats, user?.id, locallyDeleted]
    );

    return (
        <div className="flex h-full w-full min-w-0 flex-col bg-(--chat-surface)">
            {/* 1. Header: profile, presence and menu (see SidebarHeader) */}
            <SidebarHeader />

            {/* 2. Search for people */}
            <SearchPeople />

            {/* 3. Conversations */}
            <div className="chat-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                {visible === null ? (
                    <ListSkeleton />
                ) : visible.length === 0 ? (
                    <div className="flex flex-col items-center px-8 py-16 text-center">
                        <span className="mb-4 grid size-14 place-items-center rounded-full bg-(--chat-accent-soft) text-(--chat-accent-text)">
                            <MessageCircleIcon className="size-6" aria-hidden />
                        </span>
                        <p className="text-base font-semibold text-(--chat-ink)">No conversations yet</p>
                        <p className="mt-1 text-sm text-(--chat-ink-2)">Search for a person above to start chatting.</p>
                    </div>
                ) : (
                    <nav aria-label="Conversations">
                        <ul className="space-y-0.5">
                            {visible.map((chat) => {
                                // Everything in it was cleared: nothing to preview (the other person's list is untouched).
                                const cleared = isChatClearedFor(chat, user?.id);

                                // A group: its own row and its own link (?groupId=). Everything in it is in the chat document.
                                if (chat.category === "group") {
                                    const isOpen = chat.id === groupId;
                                    return (
                                        <li key={chat.id}>
                                            <Link
                                                href={`${pathname}?groupId=${encodeURIComponent(chat.id)}`}
                                                aria-current={isOpen ? "page" : undefined}
                                                className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring)"
                                            >
                                                <GroupRow
                                                    name={chat.name?.trim() || "Group"}
                                                    imageUrl={chat.imageUrl}
                                                    preview={getGroupPreview(chat, user?.id)}
                                                    lastSend={chat.updatedAt}
                                                    isSelected={isOpen}
                                                    unreadCount={getUnreadCount(chat.unreadCount, user?.id)}
                                                    today={today}
                                                />
                                            </Link>
                                        </li>
                                    );
                                }

                                const receiveId = chat.participants.find(id => id != user?.id as string) ?? '';
                                const isSelected = receiveId == receiverId;
                                return (
                                    <li key={chat.id}>
                                        <Link
                                            href={`${pathname}?receiverId=${receiveId}`}
                                            aria-current={isSelected ? "page" : undefined}
                                            className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring)"
                                        >
                                            <ReceiverInfo
                                                receiverId={receiveId as string}
                                                lastSend={cleared ? undefined : chat?.updatedAt as Timestamp}
                                                message={cleared ? '' : chat?.lastMessage}
                                                isSelected={isSelected}
                                                unreadCount={getUnreadCount(chat?.unreadCount, user?.id)}
                                                today={today}
                                            />
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                )}
            </div>
        </div>
    );
}
