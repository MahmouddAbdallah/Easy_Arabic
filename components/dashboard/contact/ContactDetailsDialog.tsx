"use client";

import { Copy, Mail, MailOpen, Reply, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import type { ContactMessage } from "@/stores/admin/contacts";
import { formatFullDate, getInitials } from "./contactUtils";
import { useContactActions } from "./useContactActions";

interface ContactDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contact: ContactMessage;
    onReply: () => void;
    onDelete: () => void;
}

export function ContactDetailsDialog({ open, onOpenChange, contact, onReply, onDelete }: ContactDetailsDialogProps) {
    const { toggleRead } = useContactActions();
    const unread = !contact.isRead;

    const copyEmail = async () => {
        try {
            await navigator.clipboard.writeText(contact.email);
            toast.success("Email address copied");
        } catch {
            toast.error("Couldn't copy the email address");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <DialogHeader className="shrink-0 gap-4 border-b p-4 pr-12 sm:p-6 sm:pr-14">
                    <DialogTitle className="text-lg leading-snug font-semibold wrap-break-word">
                        {contact.subject?.trim() || (
                            <span className="font-normal italic text-muted-foreground">No subject</span>
                        )}
                    </DialogTitle>

                    <div className="flex items-start gap-3">
                        <span
                            aria-hidden
                            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground"
                        >
                            {getInitials(contact.name, contact.email)}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{contact.name}</p>
                            <DialogDescription className="flex items-center gap-1 text-xs">
                                <a
                                    href={`mailto:${contact.email}`}
                                    className="truncate hover:text-foreground hover:underline"
                                >
                                    {contact.email}
                                </a>
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={copyEmail}
                                    aria-label="Copy email address"
                                >
                                    <Copy />
                                </Button>
                            </DialogDescription>
                            {contact.phone?.trim() && (
                                <a
                                    href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                                    className="mt-0.5 block truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                                >
                                    {contact.phone}
                                </a>
                            )}
                            <p suppressHydrationWarning className="mt-0.5 text-xs text-muted-foreground">
                                {formatFullDate(contact.createdAt)}
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                    {contact.message?.trim() ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word text-foreground">
                            {contact.message}
                        </p>
                    ) : (
                        <p className="text-sm italic text-muted-foreground">This message has no content.</p>
                    )}
                </div>

                <DialogFooter className="m-0 shrink-0 flex-row flex-wrap items-center justify-between gap-2 rounded-none sm:justify-between">
                    <Button
                        variant="ghost"
                        onClick={onDelete}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                        <Trash2 /> Delete
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => toggleRead(contact)}>
                            {unread ? <MailOpen /> : <Mail />}
                            {unread ? "Mark as read" : "Mark as unread"}
                        </Button>
                        <Button onClick={onReply}>
                            <Reply /> Reply
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
