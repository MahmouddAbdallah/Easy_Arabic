import { updateContact } from '@/lib/data/contact';
import { ContactMessage, useContactStore } from '@/stores/admin/contacts';
import { ReactNode, useState } from 'react'
import toast from 'react-hot-toast';

interface MarkAsReadProps {
    contact: Partial<ContactMessage> | undefined;
    children: ReactNode
}
const MarkAsRead = ({ children, contact }: MarkAsReadProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const updateContactMessage = useContactStore(state => state.updateContact);

    const handleMarkAsRead = async () => {
        try {
            if (!contact?.id) return;
            const updateData = { isRead: contact?.isRead == true ? false : true }
            await updateContact(contact?.id, updateData);
            updateContactMessage(contact?.id, updateData)
        } catch (error: any) {
            toast.error(error.error.message)
            console.error("Failed to delete contact:", error);
        } finally {
            setIsLoading(false);
        }
    }
    return (
        <button
            disabled={isLoading}
            onClick={handleMarkAsRead}
        >
            {children}
        </button>
    )
}

export default MarkAsRead