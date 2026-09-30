import { Mail, MailOpen, Reply, Calendar, AtSign, MessageSquare, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Dispatch, SetStateAction } from "react";
import { useContactStore } from "@/stores/admin/contacts";
import MarkAsRead from "./MarkAsRead";

export function ContactDetailsDialog({
    open,
    setOpen,
    contactId,
}: {
    open?: boolean;
    setOpen: Dispatch<SetStateAction<boolean>>;
    contactId: string | undefined;
}) {
    const contact = useContactStore(state => state.contacts.find(c => c.id == contactId))
    console.log(contact);

    // Safe Date Formatting
    const formattedDate = contact?.createdAt
        ? new Date(contact?.createdAt as string | number | Date).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
        })
        : "N/A";

    // Initials Avatar
    const initials = contact?.name
        ? contact?.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : "??";


    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="w-[95vw] max-w-150 max-h-[85vh] p-0 overflow-hidden flex flex-col rounded-xl sm:rounded-2xl border">

                {/* Header Section - Responsive */}
                <DialogHeader className="p-4 sm:p-6 bg-muted/40 border-b space-y-3 shrink-0 text-left">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm sm:text-base border border-primary/20 shrink-0">
                                {initials}
                            </div>
                            <div className="min-w-0">
                                <DialogTitle className="text-base sm:text-lg font-bold text-foreground truncate">
                                    {contact?.name || "Unknown Sender"}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                                    <AtSign className="h-3 w-3 shrink-0" />
                                    <a
                                        href={`mailto:${contact?.email}`}
                                        className="hover:underline hover:text-primary transition-colors truncate"
                                    >
                                        {contact?.email || "No email"}
                                    </a>
                                </DialogDescription>
                            </div>
                        </div>

                        {/* Read/Unread Status */}
                        <div className="shrink-0">
                            {!contact?.isRead ? (
                                <Badge variant="default" className="bg-blue-600 hover:bg-blue-700 gap-1 px-2 py-0.5 text-[11px] sm:text-xs">
                                    <Mail className="h-3 w-3" /> Unread
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-[11px] sm:text-xs text-muted-foreground">
                                    <MailOpen className="h-3 w-3" /> Read
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Subject & Date Info Block */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 pt-2 border-t border-border/40 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <Tag className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="font-medium text-foreground truncate">
                                {contact?.subject || <span className="italic font-normal text-muted-foreground">No Subject</span>}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 text-[11px] sm:text-xs">
                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                            <span>{formattedDate}</span>
                        </div>
                    </div>
                </DialogHeader>

                {/* Scrollable Message Content */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-2 flex-1">
                    <h4 className="text-[11px] sm:text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" /> Message Content
                    </h4>
                    <div className="p-3.5 sm:p-4 rounded-lg sm:rounded-xl bg-muted/30 border text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-foreground wrap-break-word min-h-30">
                        {contact?.message || <span className="italic text-muted-foreground">No message body provided.</span>}
                    </div>
                </div>

                {/* Mobile-Optimized Footer Actions */}
                <div className="p-3 sm:p-4 bg-muted/20 border-t shrink-0">
                    <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
                        {/* Mark Read/Unread */}
                        <MarkAsRead contact={contact} >
                            {!contact?.isRead ? (
                                <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs h-9 gap-1.5">
                                    <MailOpen className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                    <span>Mark Read</span>
                                </Button>
                            ) : (
                                <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs h-9 gap-1.5">
                                    <Mail className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                    <span>Mark Unread</span>
                                </Button>
                            )}
                        </MarkAsRead>

                        {/* Reply Button */}
                        <Button size="sm" className="w-full sm:w-auto text-xs h-9 gap-1.5" >
                            <Reply className="h-3.5 w-3.5 shrink-0" />
                            <span>Reply</span>
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}