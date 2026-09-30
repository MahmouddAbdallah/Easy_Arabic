import { create } from 'zustand'

export type ContactMessage = {
    id: string;
    name: string;
    email: string;
    subject?: string | null;
    message: string;
    isRead: boolean;
    createdAt: string;
    updatedAt: string;
};
export type contactState = {
    contacts: ContactMessage[];
    count: number
}


export type UserActions = {
    setContacts: (contacts: ContactMessage[]) => void
    addContact: (newContact: ContactMessage) => void
    setCount: (count: number) => void
    updateContact: (id: string, updatedFields: Partial<ContactMessage>) => void
    removeContact: (id: string) => void
    clearContacts: () => void
}

export type contactStore = contactState & UserActions

// Use `create` instead of `createStore`
export const useContactStore = create<contactStore>()((set) => ({
    contacts: [],
    count: 0,

    setContacts: (contacts) => set({ contacts }),
    setCount: (count) => set({ count }),

    addContact: (newContact) =>
        set((state) => ({
            contacts: [...state.contacts, newContact],
            count: state.count + 1
        })),

    updateContact: (id, updatedFields) =>
        set((state) => ({
            contacts: state.contacts.map((user) =>
                user.id === id ? { ...user, ...updatedFields } : user
            ),
        })),

    removeContact: (id) =>
        set((state) => ({
            contacts: state.contacts.filter((user) => user.id !== id),
            count: state.count - 1
        })),

    clearContacts: () => set({ contacts: [] }),
}))