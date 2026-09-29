import {
    Mail,
    MailOpen,
    Trash2,
    Reply,
    Calendar,
    User,
    AtSign,
    MessageSquare,
    Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Dispatch, SetStateAction } from "react";
import { ContactMessage } from "./ContactsTable";

// Dummy contact object for UI demonstration
const sampleContact = {
    id: "1",
    name: "Alex Morgan",
    email: "alex.morgan@example.com",
    subject: "Inquiry about enterprise plan pricing",
    message:
        "Hi team,\n\nI hope this email finds you well. I am reaching out to inquire about custom quotes for our organization. We currently have around 65 team members and would like to understand the enterprise features, onboarding support, and API limits.\n\nCould we schedule a short demo call this week?\n\nBest regards,\nAlex Morgan",
    isRead: false,
    createdAt: "2026-09-28T10:30:00Z",
};

export function ContactDetailsDialog({
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
            <DialogContent className="sm:max-w-[650px] gap-6">
                {/* Header Section */}
                <DialogHeader className="space-y-3">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-primary" />
                            Message Details
                        </DialogTitle>
                        {!sampleContact.isRead ? (
                            <Badge variant="default" className="bg-blue-600 hover:bg-blue-700 gap-1.5 px-3 py-1 text-xs">
                                <Mail className="h-3.5 w-3.5" /> Unread
                            </Badge>
                        ) : (
                            <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs text-muted-foreground">
                                <MailOpen className="h-3.5 w-3.5" /> Read
                            </Badge>
                        )}
                    </div>
                    <DialogDescription>
                        Detailed view of the contact form submission.
                    </DialogDescription>
                </DialogHeader>

                {/* Sender Info Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border border-border/50 text-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-background border shadow-xs text-muted-foreground">
                            <User className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground font-medium">Sender Name</span>
                            <span className="font-semibold text-foreground">{sampleContact.name}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-background border shadow-xs text-muted-foreground">
                            <AtSign className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground font-medium">Email Address</span>
                            <span className="font-semibold text-foreground">{sampleContact.email}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-background border shadow-xs text-muted-foreground">
                            <Tag className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground font-medium">Subject</span>
                            <span className="font-semibold text-foreground">
                                {sampleContact.subject || <span className="italic text-muted-foreground font-normal">No Subject</span>}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-background border shadow-xs text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground font-medium">Received Date</span>
                            <span className="font-semibold text-foreground">
                                {new Date(sampleContact.createdAt).toLocaleString("en-US", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                })}
                            </span>
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Message Content */}
                <div className="space-y-2">
                    <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                        Message Body
                    </h4>
                    <div className="p-4 rounded-xl bg-background border text-sm leading-relaxed whitespace-pre-wrap text-foreground shadow-2xs max-h-[250px] overflow-y-auto">
                        {sampleContact.message}
                    </div>
                </div>

                {/* Footer Actions */}
                <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between items-center pt-2">
                    <Button variant="outline" size="sm" className="w-full sm:w-auto text-destructive border-destructive/20 hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </Button>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {!sampleContact.isRead ? (
                            <Button variant="outline" size="sm" className="gap-2">
                                <MailOpen className="h-4 w-4 text-emerald-600" /> Mark as Read
                            </Button>
                        ) : (
                            <Button variant="outline" size="sm" className="gap-2">
                                <Mail className="h-4 w-4 text-blue-600" /> Mark as Unread
                            </Button>
                        )}

                        <Button size="sm" className="gap-2">
                            <Reply className="h-4 w-4" /> Reply
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}