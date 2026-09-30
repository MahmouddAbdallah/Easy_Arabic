'use client';
import { MoreHorizontal, Mail, MailOpen, Trash2, Reply, Eye, Calendar, MailOpenIcon, MailIcon, } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { QuickReplyDialog } from "./QuickReplyDialog";
import { useEffect, useState } from "react";
import { ContactDetailsDialog } from "./ContactDetailsDialog";
import { ContactMessage, useContactStore } from "@/stores/admin/contacts";
import MarkAsRead from "./MarkAsRead";
import { DeleteContactDialog } from "./DeleteContactDialog";

export function ContactsTable({ contacts }: { contacts: ContactMessage[] }) {
    const [isQuickReply, setIsQuickReply] = useState(false);
    const [isDeleteContact, setIsDeleteContact] = useState(false);
    const [isViewDetails, setIsViewDetails] = useState(false);
    const [data, setData] = useState<Partial<ContactMessage>>({});

    const messages = useContactStore(state => state.contacts);
    const setContacts = useContactStore(state => state.setContacts);
    useEffect(() => {
        setContacts(contacts);
    }, [setContacts, contacts]);

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
                        {(messages ?? contacts)
                            ?.map((contact) => (
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

                                                <MarkAsRead contact={contact} >
                                                    {!contact.isRead ? (
                                                        <DropdownMenuItem
                                                            className="gap-2">
                                                            <MailOpenIcon className="h-4 w-4 text-emerald-600" /> Mark as Read
                                                        </DropdownMenuItem>
                                                    ) : (
                                                        <DropdownMenuItem
                                                            className="gap-2">
                                                            <MailIcon className="h-4 w-4 text-primary" /> Mark as Unread
                                                        </DropdownMenuItem>
                                                    )}
                                                </MarkAsRead>

                                                <DropdownMenuSeparator />

                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setData(contact)
                                                        setIsDeleteContact(true);
                                                    }}
                                                    className="gap-2 text-destructive focus:text-destructive"
                                                >
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
                    contactId={data?.id}
                />
            }
            {isDeleteContact &&
                <DeleteContactDialog
                    open={isDeleteContact}
                    setOpen={setIsDeleteContact}
                    contact={data}
                />
            }
        </div>
    );
}