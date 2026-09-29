'use client';
import {
    MoreHorizontal,
    Mail,
    MailOpen,
    Trash2,
    Reply,
    Eye,
    Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { QuickReplyDialog } from "./QuickReplyDialog";
import { useState } from "react";
import { ContactDetailsDialog } from "./ContactDetailsDialog";

export type ContactMessage = {
    id: string;
    name: string;
    email: string;
    subject?: string | null; // Optional and nullable
    message: string;
    isRead: boolean;
    createdAt: string;
};
// Dummy Data matching your Prisma Schema
const sampleContacts = [
    {
        id: "1",
        name: "Alex Morgan",
        email: "alex.morgan@example.com",
        subject: "Inquiry about enterprise plan pricing",
        message: "Hi, I would like to know more about custom quotes for teams larger than 50 members.",
        isRead: false,
        createdAt: "2026-09-28T10:30:00Z",
    },
    {
        id: "2",
        name: "Sarah Jenkins",
        email: "sarah.j@techcorp.io",
        subject: "Technical support request",
        message: "We encountered an issue with the API integration yesterday night. Could you please check?",
        isRead: true,
        createdAt: "2026-09-27T14:15:00Z",
    },
    {
        id: "3",
        name: "David Chen",
        email: "d.chen@designlab.com",
        subject: null, // Test optional subject
        message: "Great platform! Just wanted to share some feedback regarding the new UI update.",
        isRead: false,
        createdAt: "2026-09-26T09:00:00Z",
    },
];

export function ContactsTable() {
    const [isQuickReply, setIsQuickReply] = useState(false);
    const [isViewDetails, setIsViewDetails] = useState(false);
    const [data, setData] = useState<Partial<ContactMessage>>({});
    return (
        <div>
            <Card className="shadow-sm border">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-20">Status</TableHead>
                            <TableHead className="w-50">Sender</TableHead>
                            <TableHead className="w-55">Subject</TableHead>
                            <TableHead>Message Preview</TableHead>
                            <TableHead className="w-37.5">Date</TableHead>
                            <TableHead className="w-15 text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sampleContacts.map((contact) => (
                            <TableRow
                                key={contact.id}
                                className={!contact.isRead ? "bg-primary/2 font-medium" : undefined}
                            >
                                {/* Status Badge */}
                                <TableCell>
                                    {!contact.isRead ? (
                                        <Badge variant="default" className="bg-primary hover:bg-primary/90 gap-1 text-[11px] font-normal">
                                            <Mail className="h-3 w-3" /> Unread
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary" className="gap-1 text-[11px] font-normal text-muted-foreground">
                                            <MailOpen className="h-3 w-3" /> Read
                                        </Badge>
                                    )}
                                </TableCell>

                                {/* Sender Details */}
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-foreground text-sm">{contact.name}</span>
                                        <span className="text-xs text-muted-foreground">{contact.email}</span>
                                    </div>
                                </TableCell>

                                {/* Subject */}
                                <TableCell>
                                    <span className="text-sm truncate block max-w-50 text-foreground">
                                        {contact.subject || <span className="text-muted-foreground italic">No Subject</span>}
                                    </span>
                                </TableCell>

                                {/* Message Preview */}
                                <TableCell>
                                    <p className="text-sm text-muted-foreground truncate max-w-[320px]">
                                        {contact.message}
                                    </p>
                                </TableCell>

                                {/* Created At */}
                                <TableCell>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {new Date(contact.createdAt).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                    </div>
                                </TableCell>

                                {/* Actions Dropdown */}
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger >
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreHorizontal className="h-4 w-4" />
                                                <span className="sr-only">Open menu</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-45">
                                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                                Actions
                                            </div>
                                            <DropdownMenuItem
                                                className="gap-2"
                                                onClick={() => {
                                                    setData(contact)
                                                    setIsViewDetails(true);
                                                }}
                                            >
                                                <Eye className="h-4 w-4 text-muted-foreground" /> View Details
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="gap-2"
                                                onClick={() => {
                                                    setData(contact)
                                                    setIsQuickReply(true);
                                                }}
                                            >
                                                <Reply className="h-4 w-4 text-primary" /> Quick Reply
                                            </DropdownMenuItem>

                                            <DropdownMenuSeparator />

                                            {!contact.isRead ? (
                                                <DropdownMenuItem className="gap-2">
                                                    <MailOpen className="h-4 w-4 text-emerald-600" /> Mark as Read
                                                </DropdownMenuItem>
                                            ) : (
                                                <DropdownMenuItem className="gap-2">
                                                    <Mail className="h-4 w-4 text-primary" /> Mark as Unread
                                                </DropdownMenuItem>
                                            )}

                                            <DropdownMenuSeparator />

                                            <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive">
                                                <Trash2 className="h-4 w-4" /> Delete Message
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
            {isQuickReply &&
                <QuickReplyDialog
                    open={isQuickReply}
                    setOpen={setIsQuickReply}
                    contact={data}
                />
            }
            {isViewDetails &&
                <ContactDetailsDialog
                    open={isViewDetails}
                    setOpen={setIsViewDetails}
                    contact={data}
                />
            }
        </div>
    );
}