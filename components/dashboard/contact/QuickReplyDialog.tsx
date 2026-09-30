import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dispatch, SetStateAction } from "react";
import { ContactMessage } from "@/stores/admin/contacts";

export function QuickReplyDialog({
    open,
    setOpen,
    contact
}: {
    open?: boolean,
    setOpen: Dispatch<SetStateAction<boolean>>,
    contact: Partial<ContactMessage>
}) {
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-137.5">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Send className="h-5 w-5 text-primary" />
                        Quick Reply
                    </DialogTitle>
                    <DialogDescription>
                        Send a direct reply to <span className="font-medium text-foreground">alex.morgan@example.com</span>.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="to">To</Label>
                        <Input id="to" value="Alex Morgan <alex.morgan@example.com>" disabled />
                    </div>
                    {contact.subject &&
                        <div className="grid gap-2">
                            <Label htmlFor="subject">Subject</Label>
                            <Input id="subject" defaultValue="Re: Inquiry about enterprise plan pricing" />
                        </div>
                    }

                    <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="reply-message">Reply Message</Label>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-primary gap-1">
                                <Sparkles className="h-3.5 w-3.5" /> Auto-generate AI Response
                            </Button>
                        </div>
                        <Textarea
                            id="reply-message"
                            rows={5}
                            placeholder="Type your response here..."
                            defaultValue="Hi Alex, Thank you for reaching out! We would be happy to discuss our enterprise options with you..."
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline">Cancel</Button>
                    <Button className="gap-2">
                        <Send className="h-4 w-4" /> Send Reply
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}