'use client';
import { userType } from '@/types/userTypes';
import axios from 'axios';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAppContext } from '@/components/AppContext';
import { ChatSidebar } from './Sidebar/ChatSidebar';
import { ChatArea } from './ChatArea/ChatArea';
import { CallProvider } from './CallProvider';
import NoChatSelected from './ChatArea/NoChatSelected';
import { getChatId } from './lib/chatId';
import { CHAT_ROOT_CLASS, CHAT_THEME_CSS } from './lib/chatTheme';
import { laterOf } from './lib/chatState';
import { useConversationState, type ConversationStateHandle } from './hooks/useConversationState';
import { useConversationActions, type ConversationActions } from './hooks/useConversationActions';
import { useViewportHeight } from './hooks/useViewportHeight';


interface ChatContextType {
    receiverId: string | null;
    receiver: Partial<userType>
    /** chats/{chatId} between the current user and the receiver; null until both are known. */
    chatId: string | null;
    /** The current user's side of the open chat: who blocked whom, and where their history starts. */
    conversation: ConversationStateHandle;
    /** Block / unblock / clear / delete for the open chat (one at a time). */
    conversationActions: ConversationActions;
    /** Chats this browser just deleted that Firestore hasn't reported yet: chatId -> deletedAt. The sidebar hides them at once. */
    locallyDeleted: Readonly<Record<string, string>>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);


export const ChatProvider: React.FC = () => {
    const searchParams = useSearchParams();
    const receiverId = searchParams.get('receiverId');
    const { user } = useAppContext();
    const chatId = user?.id && receiverId ? getChatId(user.id, receiverId) : null;
    const [receiver, setReceiver] = useState<Partial<userType>>({})
    const router = useRouter();
    const pathname = usePathname();
    const [locallyDeleted, setLocallyDeleted] = useState<Readonly<Record<string, string>>>({});

    const conversation = useConversationState(chatId, user?.id, receiverId);
    const markChatDeleted = useCallback((deletedChatId: string, deletedAt: string) => {
        setLocallyDeleted((current) => ({ ...current, [deletedChatId]: laterOf(current[deletedChatId], deletedAt) ?? deletedAt }));
    }, []);
    // `receiver` still holds the previous person for a moment after switching chats: only name who is on screen.
    const receiverName = receiverId && receiver?.id === receiverId ? receiver.name : undefined;
    const conversationActions = useConversationActions({
        chatId,
        receiverId,
        receiverName,
        conversation,
        onDeleted: markChatDeleted,
        // The chat is gone from the list: back to "no chat selected" (and to the list on a phone).
        onLeave: () => router.replace(pathname),
    });

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

    const { viewHeight, messagesTopRef } = useViewportHeight();

    return (
        <ChatContext.Provider
            value={{
                receiverId,
                receiver,
                chatId,
                conversation,
                conversationActions,
                locallyDeleted
            }}
        >
            <CallProvider>
                {/* The chat's own palette, type and motion. Scoped to `.chat-theme`: nothing outside the chat is touched. */}
                <style dangerouslySetInnerHTML={{ __html: CHAT_THEME_CSS }} />
                <div
                    className={`${CHAT_ROOT_CLASS} flex h-dvh min-h-dvh w-full items-center justify-center bg-(--chat-canvas-edge) sm:p-4 lg:p-6`}
                >
                    <div className="h-full w-full overflow-hidden bg-(--chat-surface) sm:rounded-[28px] sm:border sm:border-(--chat-line) sm:shadow-(--chat-shadow-md) lg:h-[90vh] lg:w-[90vw] lg:max-w-375">
                        <div
                            style={{ height: viewHeight }}
                            className="flex h-full w-full">
                            {/* Conversations */}
                            <aside
                                className={`${receiverId ? "hidden" : "flex"
                                    } h-full w-full shrink-0 border-e border-(--chat-line) bg-(--chat-surface) md:flex md:w-85 lg:w-95`}
                            >
                                <ChatSidebar />
                            </aside>

                            {/* The open conversation */}
                            <main
                                className={`${!receiverId ? "hidden" : "flex"
                                    } h-full min-w-0 flex-1 flex-col md:flex`}
                            >
                                <div ref={messagesTopRef} />

                                {receiverId ? <ChatArea /> : <NoChatSelected />}
                            </main>
                        </div>
                    </div>
                </div>
            </CallProvider>
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