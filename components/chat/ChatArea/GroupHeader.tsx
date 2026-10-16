"use client";

import { useState } from "react";
import { ArrowLeftIcon, InfoIcon } from "lucide-react";
import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppContext } from "@/components/AppContext";
import { GroupAvatar } from "../Groups/GroupAvatar";
import { usePushParams } from "../hooks/usePushParams";
import { ui } from "../lib/chatTheme";
import { describeMembers, type GroupInfo } from "../lib/groups";
import { GroupInfoSheet } from "./GroupInfoSheet";

interface GroupHeaderProps {
    /** The open group; null while its document is still loading (a placeholder is drawn). */
    group: GroupInfo | null;
}

/**
 * The top of an open group, laid out exactly like the header of a direct chat: the way back to the list on a phone,
 * the group (its picture and name, with who is in it underneath) as the way into the group info, and the info button.
 * Calls, search and the block / clear / delete menu are for direct conversations and have no place here yet.
 * Keyed by the group by its owner, so the info sheet never outlives the group it was opened for.
 */
export function GroupHeader({ group }: GroupHeaderProps) {
    const { user } = useAppContext();
    const { pushQuery, clearQueryByKey } = usePushParams();
    const [infoOpen, setInfoOpen] = useState(false);

    const openInfo = () => {
        pushQuery("groupInfo", "true");
        setInfoOpen(true);
    };

    return (
        <header className="relative z-10 flex h-17 shrink-0 items-center justify-between gap-2 border-b border-(--chat-line) bg-(--chat-surface) px-2 sm:px-4">
            {group && <title>{group.name}</title>}
            <div className="flex min-w-0 flex-1 items-center gap-1">
                {/* Phones show one pane at a time: this is the way back to the list. */}
                <button
                    type="button"
                    onClick={() => clearQueryByKey("groupId")}
                    aria-label="Back to conversations"
                    className={cn(ui.iconButton, "md:hidden")}
                >
                    <ArrowLeftIcon />
                </button>

                {group ? (
                    <button
                        type="button"
                        onClick={openInfo}
                        aria-label={`View group info of ${group.name}`}
                        className="group flex min-w-0 items-center gap-2.5 rounded-2xl py-1 pe-2 ps-1 text-start outline-none transition-colors hover:bg-(--chat-surface-2) focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring) sm:gap-3 sm:pe-3"
                    >
                        <GroupAvatar imageUrl={group.imageUrl} pixels={88} className="size-10 sm:size-11" />
                        <div className="flex min-w-0 flex-col leading-tight">
                            <span dir="auto" className="truncate text-base font-semibold text-(--chat-ink)">
                                {group.name}
                            </span>
                            <span dir="auto" className="mt-0.5 min-h-4.5 truncate text-[13px] text-(--chat-ink-3)">
                                {describeMembers(group.members, user?.id)}
                            </span>
                        </div>
                    </button>
                ) : (
                    <div className="flex items-center gap-3 py-1 ps-1" role="status" aria-label="Loading group">
                        <div className="chat-skeleton size-10 rounded-full sm:size-11" />
                        <div className="flex flex-col gap-2">
                            <div className="chat-skeleton h-3.5 w-32 rounded-md" />
                            <div className="chat-skeleton h-3 w-20 rounded-md" />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger type="button" aria-label="Group info" disabled={!group} onClick={openInfo} className={ui.iconButton}>
                            <InfoIcon strokeWidth={1.75} />
                        </TooltipTrigger>
                        <TooltipContent>Group info</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            {group && infoOpen && (
                <GroupInfoSheet
                    open={infoOpen}
                    onOpenChange={() => {
                        setInfoOpen(false);
                        clearQueryByKey("groupInfo");
                    }}
                    group={group}
                    currentUserId={user?.id}
                />
            )}
        </header>
    );
}
