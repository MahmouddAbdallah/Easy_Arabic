"use client";

import { FormEvent, KeyboardEvent, useState } from "react";
import { Send } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ContactMessage } from "@/stores/admin/contacts";
import { useContactActions } from "./useContactActions";

interface QuickReplyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contact: ContactMessage;
}

export function QuickReplyDialog({ open, onOpenChange, contact }: QuickReplyDialogProps) {
    const { markRead } = useContactActions();
    const originalSubject = contact.subject?.trim();
    const [subject, setSubject] = useState(
        originalSubject ? (/^re:/i.test(originalSubject) ? originalSubject : `Re: ${originalSubject}`) : "Re: Your message",
    );
    const [body, setBody] = useState(`Hi ${contact.name.split(" ")[0]},\n\n`);

    const canSend = body.trim().length > 0 && subject.trim().length > 0;

    // There is no outgoing-mail backend, so the reply is handed to the admin's own mail app.
    // Replace the body of this function with a server action when one exists.
    const send = () => {
        if (!canSend) return;
        const url = `mailto:${contact.email}?subject=${encodeURIComponent(
            subject.trim(),
        )}&body=${encodeURIComponent(body.trim())}`;
        window.location.href = url;
        void markRead(contact);
        toast.success("Reply opened in your email app");
        onOpenChange(false);
    };

    const onSubmit = (event: FormEvent) => {
        event.preventDefault();
        send();
    };

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            send();
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Quick reply</DialogTitle>
                    <DialogDescription>
                        Replying to <span className="font-medium text-foreground">{contact.name}</span>
                    </DialogDescription>
                </DialogHeader>

                <form id="quick-reply-form" onSubmit={onSubmit} onKeyDown={onKeyDown} className="grid gap-3">
                    <div className="grid gap-1.5">
                        <Label htmlFor="reply-to">To</Label>
                        <Input id="reply-to" value={contact.email} readOnly className="text-muted-foreground" />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="reply-subject">Subject</Label>
                        <Input
                            id="reply-subject"
                            value={subject}
                            onChange={(event) => setSubject(event.target.value)}
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="reply-message">Message</Label>
                        <Textarea
                            id="reply-message"
                            rows={6}
                            autoFocus
                            value={body}
                            onChange={(event) => setBody(event.target.value)}
                            placeholder="Write your reply…"
                            className="max-h-64 min-h-32"
                        />
                    </div>
                </form>

                <DialogFooter className="items-center sm:justify-between">
                    <p className="hidden text-xs text-muted-foreground sm:block">
                        Opens in your email app · <kbd className="font-mono">Ctrl</kbd>+<kbd className="font-mono">Enter</kbd> to send
                    </p>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" form="quick-reply-form" disabled={!canSend}>
                            <Send /> Send reply
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
