'use client';
import { userType } from '@/types/userTypes';
import axios from 'axios';
import { useSearchParams } from 'next/navigation';
import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ChatSidebar } from './Sidebar/ChatSidebar';
import { ChatArea } from './ChatArea/ChatArea';
import NoChatSelected from './ChatArea/NoChatSelected';


interface ChatContextType {
    receiverId: string | null;
    receiver: Partial<userType>
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);


export const ChatProvider: React.FC = () => {
    const searchParams = useSearchParams();
    const receiverId = searchParams.get('receiverId');
    const [receiver, setReceiver] = useState<Partial<userType>>({})

    useEffect(() => {
        if (!receiverId) return;
        const fetchUser = async () => {
            try {
                const { data } = await axios.get(`/api/users/${receiverId}`);
                setReceiver(data.user)
            } catch (error: any) {
                toast.error(error?.response?.data?.error?.message || error?.response?.data?.message || 'Something went wrong');
            }
        }
        fetchUser();
    }, [receiverId]);

    return (
        <ChatContext.Provider
            value={{
                receiverId,
                receiver
            }}
        >
            <div className="flex h-dvh min-h-dvh w-full items-center justify-center p-2 sm:p-4">
                <div className="h-full w-full overflow-hidden rounded-3xl border bg-background shadow-sm lg:h-[90vh] lg:w-[90vw]">
                    <div className="flex h-full w-full antialiased">
                        {/* Sidebar Section */}
                        <aside
                            className={`${receiverId ? "hidden" : "flex"
                                } h-full w-full md:flex md:w-80 lg:w-96 shrink-0 border-r`}
                        >
                            <ChatSidebar />
                        </aside>

                        {/* Main Chat Area Section */}
                        <main
                            className={`${!receiverId ? "hidden" : "flex"
                                } h-full flex-1 flex-col md:flex`}
                        >
                            {receiverId ? <ChatArea /> : <NoChatSelected />}
                        </main>
                    </div>
                </div>
            </div>
        </ChatContext.Provider>
    );
};

export const useChat = (): ChatContextType => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};

export default ChatProvider;