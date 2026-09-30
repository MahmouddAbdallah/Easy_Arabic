"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import PaginationPage from "@/components/PaginationPage";
import { cn } from "@/lib/utils";
import { ContactMessage, useContactStore } from "@/stores/admin/contacts";
import { ContactDetailsDialog } from "./ContactDetailsDialog";
import { ContactRow } from "./ContactRow";
import { ContactsEmptyState } from "./ContactsEmptyState";
import { ContactCounts, ContactsToolbar } from "./ContactsToolbar";
import { ContactQuery, CONTACTS_PAGE_SIZE, hasActiveContactFilters } from "./contactUtils";
import { DeleteContactDialog } from "./DeleteContactDialog";
import { QuickReplyDialog } from "./QuickReplyDialog";
import { useContactActions } from "./useContactActions";
import { useContactQuery } from "./useContactQuery";

type ActiveDialog = { type: "view" | "reply" | "delete"; id: string } | null;

interface ContactsTableProps {
    /** The messages for the current URL — supplied by page.tsx. */
    contacts: ContactMessage[];
    /** Total number of messages matching the current URL (across all pages). */
    count?: number;
    /** The query the server used to produce `contacts` (see `parseContactQuery`). */
    query: ContactQuery;
    pageSize?: number;
    /** Optional totals shown on the status tabs. */
    counts?: ContactCounts;
}

export function ContactsTable({
    contacts,
    count = contacts.length,
    query,
    pageSize = CONTACTS_PAGE_SIZE,
    counts,
}: ContactsTableProps) {
    const api = useContactQuery();
    const { toggleRead, markRead } = useContactActions();
    const [active, setActive] = useState<ActiveDialog>(null);

    // Keep the store in sync with the server payload. It carries optimistic edits
    // (read/unread, delete); until the first sync we render the props directly.
    const stored = useContactStore((state) => state.contacts);
    const syncedFrom = useContactStore((state) => state.syncedFrom);
    const setContacts = useContactStore((state) => state.setContacts);
    const storedCount = useContactStore((state) => state.count);
    const setCount = useContactStore((state) => state.setCount);
    useEffect(() => {
        setContacts(contacts);
        setCount(count);
    }, [contacts, count, setContacts, setCount]);

    const isSynced = syncedFrom === contacts;
    const rows = isSynced ? stored : contacts;
    const total = isSynced ? storedCount : count;
    const hasFilters = hasActiveContactFilters(query);
    const activeContact = active ? rows.find((row) => row.id === active.id) : undefined;
    const showPagination = count > contacts.length || query.page > 1;

    const open = (type: NonNullable<ActiveDialog>["type"], contact: ContactMessage) =>
        setActive({ type, id: contact.id });
    const close = () => setActive(null);

    const openMessage = (contact: ContactMessage) => {
        open("view", contact);
        if (!contact.isRead) void markRead(contact);
    };

    return (
        <TooltipProvider delay={400}>
            <Card className="gap-0 py-0 shadow-sm">
                <ContactsToolbar api={api} counts={counts} />

                {hasFilters && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                        <p aria-live="polite">
                            {total === 0 ? (
                                "No messages"
                            ) : (
                                <>
                                    <span className="font-medium text-foreground">{total}</span>{" "}
                                    {total === 1 ? "message" : "messages"}
                                </>
                            )}
                            {query.keyword && (
                                <>
                                    {" "}
                                    matching <span className="font-medium text-foreground">“{query.keyword}”</span>
                                </>
                            )}
                            {query.status && (
                                <>
                                    {" "}
                                    · <span className="font-medium text-foreground capitalize">{query.status}</span>
                                </>
                            )}
                        </p>
                        <button
                            type="button"
                            onClick={api.clearAll}
                            className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                            Clear filters
                        </button>
                    </div>
                )}

                <div aria-busy={api.isPending} className="relative border-t">
                    {api.isPending && (
                        <div className="absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse bg-primary/70" />
                    )}

                    <div className={cn("transition-opacity duration-150", api.isPending && "opacity-60")}>
                        {rows.length === 0 ? (
                            <ContactsEmptyState hasFilters={hasFilters} query={query} onClear={api.clearAll} />
                        ) : (
                            <>
                                <div className="hidden grid-cols-[2.25rem_13rem_minmax(0,1fr)_6rem] gap-4 border-b bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground md:grid">
                                    <span className="sr-only">Status</span>
                                    <span className="col-start-2">Sender</span>
                                    <span>Message</span>
                                    <span className="text-right">Received</span>
                                </div>
                                <ul className="divide-y">
                                    {rows.map((contact) => (
                                        <ContactRow
                                            key={contact.id}
                                            contact={contact}
                                            keyword={query.keyword}
                                            onOpen={openMessage}
                                            onReply={(c) => open("reply", c)}
                                            onDelete={(c) => open("delete", c)}
                                            onToggleRead={toggleRead}
                                        />
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>
                </div>

                {showPagination && <PaginationPage variant="table" count={total} pageSize={pageSize} />}
            </Card>

            {active?.type === "view" && activeContact && (
                <ContactDetailsDialog
                    open
                    onOpenChange={(next) => !next && close()}
                    contact={activeContact}
                    onReply={() => open("reply", activeContact)}
                    onDelete={() => open("delete", activeContact)}
                />
            )}
            {active?.type === "reply" && activeContact && (
                <QuickReplyDialog
                    open
                    onOpenChange={(next) => !next && close()}
                    contact={activeContact}
                />
            )}
            {active?.type === "delete" && activeContact && (
                <DeleteContactDialog
                    open
                    onOpenChange={(next) => !next && close()}
                    contact={activeContact}
                />
            )}
        </TooltipProvider>
    );
}
