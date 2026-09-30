"use client";

import { useCallback } from "react";
import toast from "react-hot-toast";
import { deleteContact, updateContact } from "@/lib/data/contact";
import { ContactMessage, useContactStore } from "@/stores/admin/contacts";

type ActionResult = { success?: boolean; error?: { message?: string } };

const errorMessage = (result: ActionResult, fallback: string) =>
    result.error?.message ?? fallback;

/**
 * Single home for the Contact page's mutations.
 * Updates the store optimistically, and rolls back + toasts if the server says no
 * (the server actions return `{ success: false }` instead of throwing).
 */
export function useContactActions() {
    const patchContact = useContactStore((state) => state.updateContact);
    const removeFromStore = useContactStore((state) => state.removeContact);

    const setRead = useCallback(
        async (contact: Pick<ContactMessage, "id" | "isRead">, isRead: boolean) => {
            if (contact.isRead === isRead) return true;

            patchContact(contact.id, { isRead });
            try {
                const result = (await updateContact(contact.id, { isRead })) as ActionResult;
                if (!result.success) throw new Error(errorMessage(result, "Could not update the message"));
                return true;
            } catch (error) {
                patchContact(contact.id, { isRead: contact.isRead });
                toast.error(error instanceof Error ? error.message : "Could not update the message");
                return false;
            }
        },
        [patchContact],
    );

    const toggleRead = useCallback(
        (contact: Pick<ContactMessage, "id" | "isRead">) => setRead(contact, !contact.isRead),
        [setRead],
    );

    /** Opening a message marks it as read — quietly, like a mail client. */
    const markRead = useCallback(
        (contact: Pick<ContactMessage, "id" | "isRead">) => setRead(contact, true),
        [setRead],
    );

    const deleteMessage = useCallback(
        async (contact: Pick<ContactMessage, "id">) => {
            try {
                const result = (await deleteContact(contact.id)) as ActionResult;
                if (!result.success) throw new Error(errorMessage(result, "Could not delete the message"));
                removeFromStore(contact.id);
                toast.success("Message deleted");
                return true;
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not delete the message");
                return false;
            }
        },
        [removeFromStore],
    );

    return { toggleRead, markRead, deleteMessage };
}
