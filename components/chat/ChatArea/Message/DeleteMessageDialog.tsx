"use client";

import { Loader2Icon } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteMessageDialogProps {
    open: boolean;
    deleting: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

export function DeleteMessageDialog({ open, deleting, onConfirm, onClose }: DeleteMessageDialogProps) {
    return (
        <AlertDialog
            open={open}
            // Don't let the dialog be dismissed mid-request.
            onOpenChange={(next) => {
                if (!next && !deleting) onClose();
            }}
        >
            <AlertDialogContent size="sm">
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete message?</AlertDialogTitle>
                    <AlertDialogDescription>
                        It will be removed for everyone in this chat. This can&apos;t be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" disabled={deleting} onClick={onConfirm}>
                        {deleting && <Loader2Icon className="animate-spin" />}
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
