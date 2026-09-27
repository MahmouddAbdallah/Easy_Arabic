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
            {/* Header */}
            <ChatHeader />
            {/* Messages Area */}
            <ScrollArea className="flex-1 min-h-0 px-4 md:px-6">
                <div className="space-y-4 max-w-3xl mx-auto py-4">
                    <div className="flex items-center justify-center my-2">
                        <span className="text-[10px] font-medium text-muted-foreground/60 bg-muted/30 px-3 py-1 rounded-full border border-border/20 backdrop-blur-sm">
                            Today
                        </span>
                    </div>

                    {loading ? (
                        <div className="text-center text-xs text-muted-foreground py-10">
                            Loading messages...
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="text-center text-xs text-muted-foreground py-10">
                            No messages yet. Send a message to start the conversation!
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex flex-col ${msg.isMe ? "items-end" : "items-start"
                                    } group`}
                            >
                                <div
                                    className={`max-w-[85%] md:max-w-[75%] p-3.5 rounded-2xl text-xs relative transition-all duration-200 shadow-sm ${msg.isMe
                                        ? "bg-primary text-primary-foreground rounded-br-xs shadow-primary/10"
                                        : "bg-muted/60 backdrop-blur-md text-foreground rounded-bl-xs border border-border/30"
                                        }`}
                                >
                                    {msg.attachment && (
                                        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-background/20 mb-2 border border-white/10">
                                            <div className="p-2 bg-primary/20 rounded-lg">
                                                <FileText className="h-5 w-5 text-primary" />
                                            </div>
                                            <div className="flex flex-col min-w-0 pr-2">
                                                <span className="font-semibold truncate text-[11px]">
                                                    {msg.attachment.fileName}
                                                </span>
                                                <span className="text-[9px] opacity-70">
                                                    {msg.attachment.fileSize}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {msg.text && (
                                        <p className="leading-relaxed tracking-tight">{msg.text}</p>
                                    )}

                                    <div
                                        className={`flex items-center justify-end gap-1 mt-1.5 text-[9px] ${msg.isMe
                                            ? "text-primary-foreground/70"
                                            : "text-muted-foreground/70"
                                            }`}
                                    >
                                        <span>{msg.time}</span>
                                        {msg.isMe && (
                                            <CheckCheck
                                                className={`h-3 w-3 ${msg.status === "read" ? "text-emerald-300" : ""}`}
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