"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
    BadgeCheckIcon,
    CalendarDaysIcon,
    KeyRoundIcon,
    MailIcon,
    PencilLineIcon,
    PhoneIcon,
    RefreshCwIcon,
    ShieldCheckIcon,
    TriangleAlertIcon,
} from "lucide-react";
import { cn } from "cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { userType } from "@/types/userTypes";
import type { AccountDetailsHandle } from "../hooks/useAccountDetails";
import type { SelfPresence } from "../hooks/useSelfPresence";
import { getInitials } from "../lib/initials";
import { getRoleLabel } from "../lib/roles";
import { InfoRow } from "../shared/InfoRow";
import { PresenceDot, PresenceLabel } from "./PresenceDot";

/** "Oct 7, 2026" from anything the server may have sent for a date; null when it isn't one. */
function formatDate(value: string | Date | null | undefined): string | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : format(date, "PP");
}

const quickLink =
    "h-auto flex-1 flex-col gap-1.5 rounded-2xl py-3 text-xs";

interface ProfileSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Where focus goes when the panel closes (the control that opened it). */
    finalFocus: () => HTMLElement | true;
    user: userType | null | undefined;
    presence: SelfPresence;
    account: AccountDetailsHandle;
}

/**
 * The signed-in user's own profile, in the style of the contact info on the other side of the chat.
 * Name, photo, role, email, phone and password date come from the session; "member since" and the verified
 * mark come from the account lookup (`account`), which has its own loading and error state so a slow or failed
 * request never hides the rest.
 */
export function ProfileSheet({ open, onOpenChange, finalFocus, user, presence, account }: ProfileSheetProps) {
    const name = user?.name?.trim() || user?.email || "Your account";
    const role = getRoleLabel(user?.role);
    const email = user?.email?.trim() || null;
    const phone = user?.phone?.trim() || null;
    const passwordChanged = formatDate(user?.passwordLastChanged);
    // /profile (details and change requests) is the customers' page; it sends everyone else home.
    const canEditProfile = user?.role === "family";

    const accountLoading = account.status === "idle" || account.status === "loading";
    const memberSince = formatDate(account.details?.createdAt);
    const emailVerified = account.status === "ready" ? Boolean(account.details?.emailVerifiedAt) : null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="left"
                finalFocus={finalFocus}
                className="gap-0 p-0 data-[side=left]:w-full data-[side=left]:sm:w-96"
            >
                <SheetHeader className="border-b border-border/40 px-4 py-3.5">
                    <SheetTitle>Profile</SheetTitle>
                    <SheetDescription className="sr-only">Your account details and shortcuts to manage them.</SheetDescription>
                </SheetHeader>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    {/* Who you are */}
                    <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-6 text-center">
                        {user ? (
                            <div className="relative">
                                <Avatar className="size-24 shadow-md ring-2 ring-border/50">
                                    <AvatarImage
                                        src={user.imageUrl || undefined}
                                        alt={`${name}'s profile photo`}
                                        referrerPolicy="no-referrer"
                                        className="object-cover"
                                    />
                                    <AvatarFallback className="text-2xl font-semibold">{getInitials(user.name)}</AvatarFallback>
                                </Avatar>
                                <PresenceDot status={presence.status} className="size-4 ring-popover" />
                            </div>
                        ) : (
                            <Skeleton className="size-24 rounded-full" />
                        )}

                        <div className="flex min-w-0 max-w-full flex-col items-center gap-1.5">
                            {user ? (
                                <h3 className="max-w-full truncate text-lg font-semibold tracking-tight select-text">{name}</h3>
                            ) : (
                                <Skeleton className="h-6 w-40" />
                            )}
                            {role && (
                                <Badge variant="secondary" className="rounded-full px-2.5 text-[11px]">
                                    {role}
                                </Badge>
                            )}
                            {user && <PresenceLabel role="status" status={presence.status} className="min-h-4 text-xs font-medium" />}
                        </div>
                    </div>

                    {/* Shortcuts that lead somewhere real */}
                    {user && (
                        <div className="flex gap-2 px-4 pb-4">
                            {canEditProfile && (
                                <Link href="/profile" className={cn(buttonVariants({ variant: "outline" }), quickLink)}>
                                    <PencilLineIcon className="size-5 text-primary" />
                                    Edit profile
                                </Link>
                            )}
                            <Link href="/change-password" className={cn(buttonVariants({ variant: "outline" }), quickLink)}>
                                <KeyRoundIcon className="size-5 text-primary" />
                                Change password
                            </Link>
                        </div>
                    )}

                    <Separator className="bg-border/40" />

                    {/* Details */}
                    <div className="px-4 py-2" aria-busy={user ? accountLoading : true}>
                        {user ? (
                            <>
                                {email && (
                                    <InfoRow Icon={MailIcon} label="Email" copyValue={email}>
                                        <span className="inline-flex max-w-full items-center gap-1.5">
                                            <span className="truncate">{email}</span>
                                            {emailVerified === true && (
                                                <BadgeCheckIcon className="size-3.5 shrink-0 text-primary" aria-label="Verified email" />
                                            )}
                                            {emailVerified === false && (
                                                <span className="shrink-0 text-[11px] font-normal text-muted-foreground">Not verified</span>
                                            )}
                                        </span>
                                    </InfoRow>
                                )}
                                {phone && (
                                    <InfoRow Icon={PhoneIcon} label="Phone" copyValue={phone}>
                                        <span dir="ltr">{phone}</span>
                                    </InfoRow>
                                )}
                                {role && (
                                    <InfoRow Icon={ShieldCheckIcon} label="Role">
                                        {role}
                                    </InfoRow>
                                )}
                                {accountLoading && (
                                    <InfoRow Icon={CalendarDaysIcon} label="Member since">
                                        <Skeleton className="my-0.5 h-4 w-28" />
                                    </InfoRow>
                                )}
                                {memberSince && (
                                    <InfoRow Icon={CalendarDaysIcon} label="Member since">
                                        {memberSince}
                                    </InfoRow>
                                )}
                                {passwordChanged && (
                                    <InfoRow Icon={KeyRoundIcon} label="Password last changed">
                                        {passwordChanged}
                                    </InfoRow>
                                )}

                                {account.status === "error" && (
                                    <div
                                        role="alert"
                                        className="my-2 flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground"
                                    >
                                        <TriangleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
                                        <p className="min-w-0 flex-1">
                                            Couldn&apos;t load the rest of your account details. {account.errorMessage}
                                        </p>
                                        <Button type="button" size="xs" variant="outline" onClick={account.retry}>
                                            <RefreshCwIcon />
                                            Try again
                                        </Button>
                                    </div>
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
                </div>
            </SheetContent>
        </Sheet>
    );
}
