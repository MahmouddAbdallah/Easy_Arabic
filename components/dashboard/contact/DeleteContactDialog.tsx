'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/components/ui/alert-dialog";
import { useState } from "react";
import { ContactMessage, useContactStore } from "@/stores/admin/contacts";
import { deleteContact } from "@/lib/data/contact";
import toast from "react-hot-toast";

interface DeleteContactDialogProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    contact: Partial<ContactMessage>;
}

export function DeleteContactDialog({
    open,
    setOpen,
    contact,
}: DeleteContactDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const removeContact = useContactStore(state => state.removeContact);

    const handleDelete = async () => {
        if (!contact.id) return;
        try {
            setIsLoading(true);
            await deleteContact(contact.id)
            removeContact(contact.id)
            setOpen(false);
        } catch (error: any) {
            toast.error(error.error.message)
            console.error("Failed to delete contact:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the message from{" "}
                        <span className="font-semibold text-foreground">
                            {contact.name || contact.email}
                        </span>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>

                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault(); // يمنع إغلاق الـ Dialog تلقائياً لحين انتهاء طلب الـ API
                            handleDelete();
                        }}
                        disabled={isLoading}
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    >
                        {isLoading ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}