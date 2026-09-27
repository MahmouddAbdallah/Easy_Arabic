"use client";

import { SquarePen, MoreVertical, LogOut, Settings, User, CheckCheck, Bell, Sparkles, } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import SearchPeople from "./SearchPeople";

export interface ChatItemType {
    id: string;
    name: string;
    avatar: string;
    lastMessage: string;
    time: string;
    unreadCount?: number;
    isOnline?: boolean;
    isRead?: boolean;
    category?: "direct" | "group";
}

export const MOCK_CHATS: ChatItemType[] = [
    {
        id: "1",
        name: "Alex Rivera",
        avatar:
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        lastMessage: "Sounds good! I'll review the pull request by tonight.",
        time: "10:42 AM",
        unreadCount: 2,
        isOnline: true,
        isRead: false,
        category: "direct",
    },
    {
        id: "2",
        name: "Core Engineering",
        avatar:
            "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80",
        lastMessage: "Sarah: The production deployment was successful 🎉",
        time: "Yesterday",
        unreadCount: 0,
        isOnline: false,
        isRead: true,
        category: "group",
    },
    {
        id: "3",
        name: "Emily Watson",
        avatar:
            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
        lastMessage: "Thanks for sending over the design tokens!",
        time: "Yesterday",
        unreadCount: 0,
        isOnline: true,
        isRead: true,
        category: "direct",
    },
    {
        id: "4",
        name: "Marcus Chen",
        avatar:
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
        lastMessage: "Can we reschedule our sync to 3 PM?",
        time: "Tue",
        unreadCount: 1,
        isOnline: false,
        isRead: false,
        category: "direct",
    },
    {
        id: "5",
        name: "Design Guild",
        avatar:
            "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=150&auto=format&fit=crop&q=80",
        lastMessage: "David shared a new Figma prototype link",
        time: "Mon",
        unreadCount: 0,
        isOnline: false,
        isRead: true,
        category: "group",
    },
];

interface ChatSidebarProps {
    selectedChatId: string;
    onSelectChat: (id: string) => void;
}

export function ChatSidebar({
    selectedChatId,
    onSelectChat,
}: ChatSidebarProps) {

    return (
        <aside className="w-full md:w-80 border-r border-border/40 h-full flex flex-col bg-background/60 backdrop-blur-2xl select-none shrink-0 transition-all">
            {/* 1. Header */}
            <div className="h-16 px-4 border-b border-border/30 flex items-center justify-between bg-card/20 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="relative group cursor-pointer">
                        <div className="absolute -inset-0.5 bg-linear-to-r from-primary to-purple-600 rounded-full blur opacity-40 group-hover:opacity-75 transition duration-300" />
                        <Avatar className="h-9 w-9 relative ring-1 ring-background/80 shadow-md">
                            <AvatarImage
                                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80"
                                alt="Current User"
                            />
                            <AvatarFallback className="text-xs font-semibold bg-muted">
                                JD
                            </AvatarFallback>
                        </Avatar>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-background shadow-sm" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-semibold text-sm tracking-tight flex items-center gap-1.5">
                            Messages
                            <Sparkles className="h-3 w-3 text-primary fill-primary/20" />
                        </span>
                        <span className="text-[11px] text-muted-foreground/80 font-medium">
                            Available
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-all"
                    >
                        <SquarePen className="h-4 w-4" />
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger >
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-all"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            className="w-52 rounded-xl backdrop-blur-lg border-border/50"
                        >
                            <DropdownMenuItem className="gap-2.5 text-xs font-medium cursor-pointer rounded-lg">
                                <User className="h-3.5 w-3.5 text-muted-foreground" /> Profile
                                Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2.5 text-xs font-medium cursor-pointer rounded-lg">
                                <Bell className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                                Notifications
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2.5 text-xs font-medium cursor-pointer rounded-lg">
                                <Settings className="h-3.5 w-3.5 text-muted-foreground" /> App
                                Preferences
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border/40" />
                            <DropdownMenuItem className="gap-2.5 text-xs font-medium cursor-pointer rounded-lg text-destructive focus:text-destructive">
                                <LogOut className="h-3.5 w-3.5" /> Log Out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* 2. Search & Filters */}
            <SearchPeople />

            {/* 3. Chat List */}
            <ScrollArea className="flex-1 px-2">
                <div className="space-y-1 py-1">
                    {MOCK_CHATS.map((chat) => {
                        const isSelected = selectedChatId === chat.id;

                        return (
                            <button
                                key={chat.id}
                                onClick={() => onSelectChat(chat.id)}
                                className={`w-full flex items-center gap-3 p-2.5 rounded-2xl transition-all duration-200 text-left relative group ${isSelected
                                    ? "bg-accent/80 text-accent-foreground shadow-sm shadow-black/5 ring-1 ring-border/50 font-medium"
                                    : "hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                {/* Active Indicator */}
                                {isSelected && (
                                    <span className="absolute left-1.5 top-3 bottom-3 w-1 bg-primary rounded-full shadow-sm shadow-primary/50" />
                                )}

                                {/* Avatar */}
                                <div className="relative shrink-0 ml-1">
                                    <Avatar className="h-10 w-10 shadow-sm ring-1 ring-border/30">
                                        <AvatarImage
                                            src={chat.avatar}
                                            alt={chat.name}
                                            className="object-cover"
                                        />
                                        <AvatarFallback className="text-xs bg-muted font-semibold">
                                            {chat.name.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    {chat.isOnline && (
                                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-background shadow-sm" />
                                    )}
                                </div>

                                {/* Details */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <span
                                            className={`text-xs truncate tracking-tight ${isSelected
                                                ? "font-semibold text-foreground"
                                                : "font-medium text-foreground/90"
                                                }`}
                                        >
                                            {chat.name}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground/70 shrink-0 font-normal">
                                            {chat.time}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        {chat.isRead && !chat.unreadCount && (
                                            <CheckCheck className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                                        )}
                                        <p
                                            className={`text-[11px] truncate ${chat.unreadCount
                                                ? "text-foreground font-semibold"
                                                : "text-muted-foreground/70 font-normal"
                                                }`}
                                        >
                                            {chat.lastMessage}
                                        </p>
                                    </div>
                                </div>

                                {/* Unread Badge */}
                                {chat.unreadCount ? (
                                    <Badge
                                        variant="default"
                                        className="h-4 min-w-4 px-1.5 flex items-center justify-center text-[10px] font-bold rounded-full bg-primary text-primary-foreground shadow-sm shadow-primary/30 shrink-0"
                                    >
                                        {chat.unreadCount}
                                    </Badge>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            </ScrollArea>
        </aside>
    );
}