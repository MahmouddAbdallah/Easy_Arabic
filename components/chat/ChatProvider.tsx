import { userType } from '@/types/userTypes';
import axios from 'axios';
import { useSearchParams } from 'next/navigation';
import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import toast from 'react-hot-toast';


interface ChatContextType {
    receiverId: string | null;
    receiver: Partial<userType>
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatProviderProps {
    children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
    const searchParams = useSearchParams();
    const receiverId = searchParams.get('receiverId');
    const [receiver, setReceiver] = useState<Partial<userType>>({})
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const { data } = await axios.get(`/api/users/${receiverId}`);
                setReceiver(data.user)
            } catch (error: any) {
                toast.error(error?.response?.data?.error?.message || error?.response?.data?.message || 'Something went wrong');
            }
        }
        fetchUser();
    }, [receiverId])
    return (
        <ChatContext.Provider
            value={{
                receiverId,
                receiver
            }}
        >
            {children}
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