"use client";

import type { ComponentType } from "react";
import { format } from "date-fns";
import {
    BadgeCheckIcon,
    BanIcon,
    BroomSparkles,
    CalendarDaysIcon,
    Loader2Icon,
    MailIcon,
    PhoneIcon,
    SearchIcon,
    ShieldCheckIcon,
    Trash2Icon,
    UserCheckIcon,
    VideoIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";
import { useChat } from "../ChatProvider";
import { useUserPresence } from "../hooks/useUserPresence";
import type { CallMode } from "../lib/call";
import { formatLastSeen } from "../lib/presence";
import { getRoleLabel } from "../lib/roles";
import { InfoRow } from "../shared/InfoRow";
import type { ConfirmableAction } from "./ConversationActionDialog";

interface QuickActionProps {
    Icon: ComponentType<{ className?: string }>;
    label: string;
    disabled?: boolean;
    onClick: () => void;
}

function QuickAction({ Icon, label, disabled, onClick }: QuickActionProps) {
    return (
        <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={onClick}
            className="h-auto flex-1 flex-col gap-1.5 rounded-2xl py-3 text-xs"
        >
            <Icon className="size-5 text-primary" />
            {label}
        </Button>
    );
}

interface ContactInfoSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The other person is typing right now. */
    isTyping: boolean;
    /** There is something to clear (the chat has messages). */
    canClear: boolean;
    /** Calls can't be placed: one is already running, or the conversation is blocked. */
    callDisabled: boolean;
    onCall: (mode: CallMode) => void;
    /** Absent when the chat can't be searched. */
    onSearch?: () => void;
    /** Opens the confirmation for the action (the header owns the dialogs). */
    onConfirmAction: (action: ConfirmableAction) => void;
    onUnblock: () => void;
}

export function ContactInfoSheet({
    open,
    onOpenChange,
    isTyping,
    canClear,
    callDisabled,
    onCall,
    onSearch,
    onConfirmAction,
    onUnblock,
}: ContactInfoSheetProps) {
    const { receiver, receiverId, conversation, conversationActions } = useChat();
    // `receiver` still holds the previous person for a moment after switching chats.
    const person = receiverId && receiver?.id === receiverId ? receiver : null;
    const presence = useUserPresence(receiverId, open);
    const { busy, pending } = conversationActions;

    const createdAt = person?.createdAt ? new Date(person.createdAt) : null;
    const memberSince = createdAt && !Number.isNaN(createdAt.getTime()) ? format(createdAt, "PP") : null;
    const role = getRoleLabel(person?.role);

    const presenceLabel = isTyping
        ? "Typing..."
        : presence.online
            ? "Online"
            : presence.known && presence.lastChanged
                ? `Last seen ${formatLastSeen(presence.lastChanged)}`
                : presence.known
                    ? "Offline"
                    : "";

    const dangerButton =
        "h-auto w-full justify-start gap-3 rounded-xl px-3 py-2.5 text-sm font-medium disabled:opacity-40";

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:w-96"
                aria-busy={busy}
            >
                <SheetHeader className="border-b border-border/40 px-4 py-3.5">
                    <SheetTitle>Contact info</SheetTitle>
                    <SheetDescription className="sr-only">
                        Profile details of the person you are chatting with, and actions for this conversation.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto">
                    {/* Profile */}
                    <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-6 text-center">
                        {person ? (
                            <Avatar className="size-24 shadow-md ring-2 ring-border/50">
                                <AvatarImage src={person.imageUrl || undefined} alt={person.name ?? "Contact"} className="object-cover" />
                                <AvatarFallback className="text-2xl font-semibold">
                                    {person.name?.slice(0, 2).toUpperCase() || "?"}
                                </AvatarFallback>
                            </Avatar>
                        ) : (
                            <Skeleton className="size-24 rounded-full" />
                        )}

                        <div className="flex min-w-0 max-w-full flex-col items-center gap-1.5">
                            {person ? (
                                <h3 className="max-w-full truncate text-lg font-semibold tracking-tight select-text">
                                    {person.name}
                                </h3>
                            ) : (
                                <Skeleton className="h-6 w-40" />
                            )}
                            {role && (
                                <Badge variant="secondary" className="rounded-full px-2.5 text-[11px]">
                                    {role}
                                </Badge>
                            )}
                            <p
                                role="status"
                                className={cn(
                                    "min-h-4 text-xs font-medium",
                                    isTyping ? "animate-pulse text-primary" : presence.online ? "text-emerald-500" : "text-muted-foreground"
                                )}
                            >
                                {presenceLabel}
                            </p>
                        </div>
                    </div>

                    {/* Quick actions */}
                    <div className="flex gap-2 px-4 pb-4">
                        <QuickAction Icon={PhoneIcon} label="Voice" disabled={!person || callDisabled} onClick={() => onCall("audio")} />
                        <QuickAction Icon={VideoIcon} label="Video" disabled={!person || callDisabled} onClick={() => onCall("video")} />
                        {onSearch && <QuickAction Icon={SearchIcon} label="Search" onClick={onSearch} />}
                    </div>

                    {conversation.blockedByMe && (
                        <div className="mx-4 mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                            <BanIcon className="mt-0.5 size-4 shrink-0" />
                            <p>You blocked this contact. You can&apos;t message or call each other until you unblock them.</p>
                        </div>
                    )}
                    {!conversation.blockedByMe && conversation.blockedByOther && (
                        <div className="mx-4 mb-4 flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
                            <BanIcon className="mt-0.5 size-4 shrink-0" />
                            <p>You can&apos;t message or call this person right now.</p>
                        </div>
                    )}

                    <Separator className="bg-border/40" />

                    {/* Details */}
                    <div className="px-4 py-2">
                        {person ? (
                            <>
                                {person.email && (
                                    <InfoRow Icon={MailIcon} label="Email" copyValue={person.email}>
                                        <span className="inline-flex max-w-full items-center gap-1.5">
                                            <span className="truncate">{person.email}</span>
                                            {person.emailVerifiedAt && (
                                                <BadgeCheckIcon className="size-3.5 shrink-0 text-primary" aria-label="Verified email" />
                                            )}
                                        </span>
                                    </InfoRow>
                                )}
                                {person.phone && (
                                    <InfoRow Icon={PhoneIcon} label="Phone" copyValue={person.phone}>
                                        <span dir="ltr">{person.phone}</span>
                                    </InfoRow>
                                )}
                                {role && (
                                    <InfoRow Icon={ShieldCheckIcon} label="Role">
                                        {role}
                                    </InfoRow>
                                )}
                                {memberSince && (
                                    <InfoRow Icon={CalendarDaysIcon} label="Member since">
                                        {memberSince}
                                    </InfoRow>
                                )}
                            </>
                        ) : (
                            <div className="space-y-3 py-2">
                                <Skeleton className="h-11 w-full rounded-xl" />
                                <Skeleton className="h-11 w-full rounded-xl" />
                                <Skeleton className="h-11 w-full rounded-xl" />
                            </div>
                        )}
                    </div>

                    <Separator className="bg-border/40" />

                    {/* Actions on the conversation */}
                    <div className="space-y-1 p-3">
                        {conversation.blockedByMe ? (
                            <Button type="button" variant="ghost" disabled={busy} onClick={onUnblock} className={dangerButton}>
                                {pending === "unblock" ? <Loader2Icon className="animate-spin" /> : <UserCheckIcon />}
                                Unblock contact
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                variant="ghost"
                                disabled={busy || !person}
                                onClick={() => onConfirmAction("block")}
                                className={cn(dangerButton, "text-destructive hover:bg-destructive/10 hover:text-destructive")}
                            >
                                <BanIcon />
                                Block contact
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="ghost"
                            disabled={busy || !canClear}
                            onClick={() => onConfirmAction("clear")}
                            className={cn(dangerButton, "text-destructive hover:bg-destructive/10 hover:text-destructive")}
                        >
                            <BroomSparkles />
                            Clear chat
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => onConfirmAction("delete")}
                            className={cn(dangerButton, "text-destructive hover:bg-destructive/10 hover:text-destructive")}
                        >
                            <Trash2Icon />
                            Delete chat
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
