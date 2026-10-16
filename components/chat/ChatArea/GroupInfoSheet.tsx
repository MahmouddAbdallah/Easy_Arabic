"use client";

import { CalendarDaysIcon, UserRoundIcon } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { GroupAvatar, PersonAvatar } from "../Groups/GroupAvatar";
import { CHAT_ROOT_CLASS } from "../lib/chatTheme";
import { formatMemberCount, type GroupInfo } from "../lib/groups";
import { getRoleLabel } from "../lib/roles";
import { InfoRow } from "../shared/InfoRow";

interface GroupInfoSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    group: GroupInfo;
    currentUserId: string | undefined;
}

/** The group at a glance: its picture, name and description, who made it and when, and everybody in it. */
export function GroupInfoSheet({ open, onOpenChange, group, currentUserId }: GroupInfoSheetProps) {
    const creator = group.members.find((member) => member.id === group.createdBy);
    const createdOn = group.createdAt?.toLocaleDateString(undefined, { dateStyle: "long" });

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className={cn(CHAT_ROOT_CLASS, "gap-0 bg-(--chat-surface) p-0 data-[side=right]:w-full data-[side=right]:sm:w-96")}>
                <SheetHeader className="border-b border-border/40 px-4 py-3.5">
                    <SheetTitle>Group info</SheetTitle>
                    <SheetDescription className="sr-only">The details and the members of this group.</SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto">
                    <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-5 text-center">
                        <GroupAvatar imageUrl={group.imageUrl} pixels={192} className="size-24 shadow-md ring-2 ring-border/50" />
                        <div className="flex min-w-0 max-w-full flex-col items-center gap-1">
                            <h3 dir="auto" className="max-w-full text-lg font-semibold tracking-tight wrap-break-word select-text">
                                {group.name}
                            </h3>
                            <p className="text-xs font-medium text-muted-foreground">Group · {formatMemberCount(group.members.length)}</p>
                        </div>
                        {group.description && (
                            <p dir="auto" className="max-w-full text-sm whitespace-pre-wrap text-muted-foreground wrap-break-word select-text">
                                {group.description}
                            </p>
                        )}
                    </div>

                    <Separator className="bg-border/40" />

                    <div className="px-4 py-2">
                        {creator && (
                            <InfoRow Icon={UserRoundIcon} label="Created by">
                                {creator.id === currentUserId ? "You" : creator.name}
                            </InfoRow>
                        )}
                        {createdOn && (
                            <InfoRow Icon={CalendarDaysIcon} label="Created on">
                                {createdOn}
                            </InfoRow>
                        )}
                    </div>

                    <Separator className="bg-border/40" />

                    <section aria-labelledby="group-members-heading" className="px-2 py-3">
                        <h4 id="group-members-heading" className="px-3 pb-1.5 text-[13px] font-medium text-muted-foreground">
                            {formatMemberCount(group.members.length)}
                        </h4>
                        <ul>
                            {group.members.map((member) => {
                                const role = getRoleLabel(member.role);
                                const isAdmin = group.admins.includes(member.id);
                                return (
                                    <li key={member.id} className="flex items-center gap-3 rounded-xl px-3 py-2">
                                        <PersonAvatar name={member.name} imageUrl={member.imageUrl} className="size-10" />
                                        <div className="min-w-0 flex-1">
                                            <p dir="auto" className="truncate text-[15px] font-medium text-foreground">
                                                {member.name}
                                                {member.id === currentUserId && <span className="font-normal text-muted-foreground"> (You)</span>}
                                            </p>
                                            {role && <p className="truncate text-[13px] text-muted-foreground">{role}</p>}
                                        </div>
                                        {isAdmin && (
                                            <Badge variant="secondary" className="shrink-0 rounded-full px-2.5 text-[11px]">
                                                Group admin
                                            </Badge>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                </div>
            </SheetContent>
        </Sheet>
    );
}
