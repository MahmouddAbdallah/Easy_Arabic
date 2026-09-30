"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ContactMessage } from "@/stores/admin/contacts";
import { useContactActions } from "./useContactActions";

interface DeleteContactDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contact: ContactMessage;
}

export function DeleteContactDialog({ open, onOpenChange, contact }: DeleteContactDialogProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const { deleteMessage } = useContactActions();

    const handleDelete = async () => {
        setIsDeleting(true);
        const deleted = await deleteMessage(contact);
        setIsDeleting(false);
        if (deleted) onOpenChange(false);
    };

    return (
        <AlertDialog open={open} onOpenChange={(next) => !isDeleting && onOpenChange(next)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogMedia className="bg-destructive/10 text-destructive">
                        <Trash2 />
                    </AlertDialogMedia>
                    <AlertDialogTitle>Delete this message?</AlertDialogTitle>
                    <AlertDialogDescription>
                        The message from{" "}
                        <span className="font-medium text-foreground">{contact.name || contact.email}</span>
                        {contact.subject?.trim() && (
                            <>
                                {" "}
                                about <span className="font-medium text-foreground">“{contact.subject.trim()}”</span>
                            </>
                        )}{" "}
                        will be permanently deleted. This can’t be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting && <Loader2 className="animate-spin" />}
                        {isDeleting ? "Deleting…" : "Delete"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
