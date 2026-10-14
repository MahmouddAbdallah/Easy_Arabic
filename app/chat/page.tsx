import ChatProvider from '@/components/chat/ChatProvider'
import { Viewport } from 'next'

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
}


const Chat = () => {
    return (
        <div>
            <ChatProvider />
        </div>
    )
}

export default Chat