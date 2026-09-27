"use client";

import { ChatArea } from "@/components/chat/ChatArea/ChatArea";
import { ChatSidebar } from "@/components/chat/Sidebar/ChatSidebar";
import { useState } from "react";
import ChatProvider from "./ChatProvider";

export default function ChatPage() {
    const [selectedChatId, setSelectedChatId] = useState<string>("1");
    const [showMobileChat, setShowMobileChat] = useState<boolean>(false);

    const handleSelectChat = (id: string) => {
        setSelectedChatId(id);
        setShowMobileChat(true);
    };

    return (
        <ChatProvider>
            <div className="flex h-screen w-full overflow-hidden bg-background antialiased">
                <div className={`${showMobileChat ? "hidden" : "flex"} md:flex w-full md:w-auto h-full`}>
                    <ChatSidebar
                        selectedChatId={selectedChatId}
                        onSelectChat={handleSelectChat}
                    />
                </div>
                <div className={`${!showMobileChat ? "hidden" : "flex"} md:flex flex-1 h-full`}>
                    <ChatArea />
                </div>
            </div>
        </ChatProvider>
    );
}