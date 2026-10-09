"use client";

import { BanIcon, BroomSparkles, Loader2Icon, Trash2Icon } from "lucide-react";
import type { ComponentType } from "react";
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

/** The actions that need a confirmation. (Unblocking is harmless and takes effect at once.) */
export type ConfirmableAction = "block" | "clear" | "delete";

interface DialogCopy {
    title: (name: string) => string;
    description: (name: string) => string;
    confirm: string;
    Icon: ComponentType<{ className?: string }>;
}

const COPY: Record<ConfirmableAction, DialogCopy> = {
    block: {
        title: (name) => `Block ${name}?`,
        description: (name) =>
            `${name} won't be able to message or call you, and you won't be able to message or call them. ` +
            `Your conversation stays as it is, and you can unblock them at any time.`,
        confirm: "Block",
        Icon: BanIcon,
    },
    clear: {
        title: () => "Clear this chat?",
        description: (name) =>
            `All messages will be removed from your view. ${name} keeps their own copy of the conversation.`,
        confirm: "Clear chat",
        Icon: BroomSparkles,
    },
    delete: {
        title: () => "Delete this chat?",
        description: (name) =>
            `The conversation will disappear from your chats and its messages from your view. ${name} keeps their own copy, ` +
            `and if they write to you again the chat comes back with only the new messages.`,
        confirm: "Delete chat",
        Icon: Trash2Icon,
    },
};

interface ConversationActionDialogProps {
    /** Which confirmation is showing; null = closed. */
    action: ConfirmableAction | null;
    /** The other person, for the wording. */
    name?: string;
    /** The request is running: the dialog can't be dismissed and can't fire twice. */
    pending: boolean;
    onConfirm: (action: ConfirmableAction) => void;
    onClose: () => void;
}

export function ConversationActionDialog({ action, name, pending, onConfirm, onClose }: ConversationActionDialogProps) {
    // Kept while the dialog animates out, so its text doesn't blank for a frame as it closes.
    const copy = COPY[action ?? "block"];
    const who = name?.trim() || "this person";

    return (
        <AlertDialog
            open={action !== null}
            // Don't let the dialog be dismissed mid-request: the person would lose sight of the outcome.
            onOpenChange={(next) => {
                if (!next && !pending) onClose();
            }}
        >
            <AlertDialogContent size="sm">
                <AlertDialogHeader>
                    <AlertDialogMedia className="bg-destructive/10 text-destructive">
                        <copy.Icon />
                    </AlertDialogMedia>
                    <AlertDialogTitle>{copy.title(who)}</AlertDialogTitle>
                    <AlertDialogDescription>{copy.description(who)}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        disabled={pending}
                        aria-busy={pending}
                        onClick={() => action && onConfirm(action)}
                    >
                        {pending && <Loader2Icon className="animate-spin" />}
                        {copy.confirm}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
