"use client";

import { Fragment } from "react";
import { Mail, MailOpen, MoreHorizontal, Reply, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ContactMessage } from "@/stores/admin/contacts";
import { formatFullDate, formatListDate, getInitials, toPreview } from "./contactUtils";

/** Wraps matches of `keyword` in <mark>. Purely visual — filtering itself happens on the server. */
function Highlight({ text, keyword }: { text: string; keyword: string }) {
    if (!keyword) return <>{text}</>;
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));
    return (
        <>
            {parts.map((part, index) =>
                index % 2 === 1 ? (
                    <mark key={index} className="rounded-sm bg-yellow-200/80 px-0.5 text-inherit dark:bg-yellow-500/30">
                        {part}
                    </mark>
                ) : (
                    <Fragment key={index}>{part}</Fragment>
                ),
            )}
        </>
    );
}

function QuickAction({
    label,
    onClick,
    className,
    children,
}: {
    label: string;
    onClick: () => void;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={label}
                        onClick={onClick}
                        className={className}
                    />
                }
            >
                {children}
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

interface ContactRowProps {
    contact: ContactMessage;
    keyword: string;
    onOpen: (contact: ContactMessage) => void;
    onReply: (contact: ContactMessage) => void;
    onDelete: (contact: ContactMessage) => void;
    onToggleRead: (contact: ContactMessage) => void;
}

export function ContactRow({ contact, keyword, onOpen, onReply, onDelete, onToggleRead }: ContactRowProps) {
    const unread = !contact.isRead;
    const subject = contact.subject?.trim();
    const preview = toPreview(contact.message);
    const date = formatListDate(contact.createdAt);
    const readLabel = unread ? "Mark as read" : "Mark as unread";
    const ReadIcon = unread ? MailOpen : Mail;

    return (
        <li
            className={cn(
                "group relative transition-colors hover:bg-muted/50 focus-within:bg-muted/50",
                unread && "bg-blue-500/4 dark:bg-blue-400/5",
            )}
        >
            <button
                type="button"
                onClick={() => onOpen(contact)}
                aria-label={`${unread ? "Unread message" : "Message"} from ${contact.name}${subject ? `: ${subject}` : ""}`}
                className="flex w-full items-start gap-3 py-3 pl-4 pr-14 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 md:items-center md:gap-4 md:pr-4"
            >
                <span
                    aria-hidden
                    className={cn(
                        "relative flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        unread
                            ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                            : "bg-muted text-muted-foreground",
                    )}
                >
                    {getInitials(contact.name, contact.email)}
                    {unread && (
                        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-blue-500 ring-2 ring-card" />
                    )}
                </span>

                <span className="min-w-0 flex-1 md:grid md:grid-cols-[13rem_minmax(0,1fr)_6rem] md:items-center md:gap-4">
                    <span className="flex min-w-0 items-baseline justify-between gap-2 md:block">
                        <span
                            className={cn(
                                "block truncate text-sm",
                                unread ? "font-semibold text-foreground" : "font-medium text-foreground/80",
                            )}
                        >
                            <Highlight text={contact.name} keyword={keyword} />
                        </span>
                        <span
                            suppressHydrationWarning
                            className="shrink-0 text-xs text-muted-foreground md:hidden"
                        >
                            {date}
                        </span>
                        <span className="hidden truncate text-xs text-muted-foreground md:block">
                            <Highlight text={contact.email} keyword={keyword} />
                        </span>
                    </span>

                    <span className="mt-0.5 block truncate text-sm md:mt-0">
                        <span
                            className={cn(
                                unread ? "font-semibold text-foreground" : "text-foreground/80",
                                !subject && "font-normal italic text-muted-foreground",
                            )}
                        >
                            {subject ? <Highlight text={subject} keyword={keyword} /> : "No subject"}
                        </span>
                        <span className="hidden text-muted-foreground md:inline">
                            {" — "}
                            <Highlight text={preview} keyword={keyword} />
                        </span>
                    </span>

                    <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground md:hidden">
                        <Highlight text={preview} keyword={keyword} />
                    </span>

                    <span
                        suppressHydrationWarning
                        title={formatFullDate(contact.createdAt)}
                        className={cn(
                            "hidden text-right text-xs tabular-nums transition-opacity md:block",
                            unread ? "font-medium text-foreground" : "text-muted-foreground",
                            "group-hover:invisible group-focus-within:invisible",
                        )}
                    >
                        {date}
                    </span>
                </span>
            </button>

            {/* Desktop: quick actions replace the date on hover / focus */}
            <div className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 md:flex">
                <QuickAction label={readLabel} onClick={() => onToggleRead(contact)}>
                    <ReadIcon />
                </QuickAction>
                <QuickAction label="Quick reply" onClick={() => onReply(contact)}>
                    <Reply />
                </QuickAction>
                <QuickAction
                    label="Delete"
                    onClick={() => onDelete(contact)}
                    className="hover:bg-destructive/10 hover:text-destructive"
                >
                    <Trash2 />
                </QuickAction>
            </div>

            {/* Mobile / touch: one menu with everything */}
            <div className="absolute right-2 top-2 md:hidden">
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon" aria-label="Message actions" />}
                    >
                        <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => onOpen(contact)}>
                            <Eye /> View message
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onReply(contact)}>
                            <Reply /> Quick reply
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onToggleRead(contact)}>
                            <ReadIcon /> {readLabel}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => onDelete(contact)}>
                            <Trash2 /> Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </li>
    );
}
