"use client";

import { useState, useRef, useEffect } from "react";
import { CheckCheck, FileText, } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import InputMessage from "./InputMessage";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { useChat } from "../ChatProvider";
import { useAppContext } from "@/components/AppContext";
import { firebaseClientDB } from "@/lib/config/firebase-client";
import ChatHeader from "./ChatHeader";

export interface MessageType {
    id: string;
    senderId: string;
    text: string;
    time: string;
    isMe: boolean;
    status?: "sent" | "delivered" | "read";
    attachment?: {
        type: "image" | "file";
        url?: string;
        fileName?: string;
        fileSize?: string;
    };
}
function generateChatId(id1: string, id2: string): string {
    return [id1, id2].sort().join("_");
}

export function ChatArea() {
    const [messages, setMessages] = useState<MessageType[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const { receiverId } = useChat();
    const { user } = useAppContext();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (!user?.id || !receiverId) return;

        setLoading(true);
        const chatId = generateChatId(user.id, receiverId);
        const messagesRef = collection(firebaseClientDB, "chats", chatId, "messages");
        const q = query(messagesRef, orderBy("time", "asc"));
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const fetchedMessages: MessageType[] = snapshot.docs.map((docSnap) => {
                    const data = docSnap.data();

                    let formattedTime = "";
                    if (data.time) {
                        const dateObj = new Date(data.time);
                        if (!isNaN(dateObj.getTime())) {
                            formattedTime = dateObj.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                            });
                        }
                    }

                    return {
                        id: docSnap.id,
                        senderId: data.senderId,
                        text: data.text || "",
                        time: formattedTime,
                        isMe: data.senderId === user?.id,
                        status: data.status || "sent",
                        attachment: data.attachment,
                    };
                });

                setMessages(fetchedMessages);
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching realtime messages: ", error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user?.id, receiverId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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
                            <div
                                key={msg.id}
                                className={`flex flex-col ${msg.isMe ? "items-end" : "items-start"
                                    } group transition-all duration-150`}
                            >
                                <div
                                    className={`max-w-[85%] md:max-w-[70%] p-3.5 md:p-4 rounded-2xl text-xs relative transition-all duration-200 shadow-sm ${msg.isMe
                                        ? "bg-linear-to-br from-primary to-primary/90 text-primary-foreground rounded-br-xs shadow-primary/15"
                                        : "bg-muted/70 backdrop-blur-xl text-foreground rounded-bl-xs border border-border/40 shadow-slate-900/5"
                                        }`}
                                >
                                    {msg.attachment && (
                                        <div
                                            className={`flex items-center gap-3 p-2.5 rounded-xl mb-2.5 border transition-colors ${msg.isMe
                                                ? "bg-black/10 border-white/15"
                                                : "bg-background/40 border-border/30 hover:bg-background/60"
                                                }`}
                                        >
                                            <div
                                                className={`p-2 rounded-lg flex items-center justify-center shrink-0 ${msg.isMe
                                                    ? "bg-white/15 text-primary-foreground"
                                                    : "bg-primary/10 text-primary"
                                                    }`}
                                            >
                                                <FileText className="h-4 w-4" />
                                            </div>
                                            <div className="flex flex-col min-w-0 pr-1">
                                                <span className="font-medium truncate text-[11px] leading-tight">
                                                    {msg.attachment.fileName}
                                                </span>
                                                <span
                                                    className={`text-[9px] mt-0.5 ${msg.isMe ? "opacity-80" : "text-muted-foreground"
                                                        }`}
                                                >
                                                    {msg.attachment.fileSize}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {msg.text && (
                                        <p className="leading-relaxed tracking-tight text-[12px] md:text-[13px] whitespace-pre-wrap wrap-break-word">
                                            {msg.text}
                                        </p>
                                    )}

                                    <div
                                        className={`flex items-center justify-end gap-1 mt-1.5 text-[9px] select-none ${msg.isMe
                                            ? "text-primary-foreground/75"
                                            : "text-muted-foreground/70"
                                            }`}
                                    >
                                        <span>{msg.time}</span>
                                        {msg.isMe && (
                                            <CheckCheck
                                                className={`h-3 w-3 transition-colors ${msg.status === "read"
                                                    ? "text-emerald-300 dark:text-emerald-400"
                                                    : "opacity-60"
                                                    }`}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </ScrollArea>
            <InputMessage />
        </div>
    );
}
