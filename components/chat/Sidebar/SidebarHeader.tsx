"use client";

import { memo, useCallback, useId, useRef, useState } from "react";
import { MoreVerticalIcon, SlidersHorizontalIcon, UserRoundIcon, UsersIcon } from "lucide-react";
import { useAppContext } from "@/components/AppContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { useAccountDetails } from "../hooks/useAccountDetails";
import { useSelfPresence } from "../hooks/useSelfPresence";
import { getInitials } from "../lib/initials";
import { PresenceDot, PresenceLabel } from "./PresenceDot";
import { PreferencesSheet } from "./PreferencesSheet";
import { ProfileSheet } from "./ProfileSheet";
import { ui } from "../lib/chatTheme";
import { cn } from "cn";

type Panel = "profile" | "preferences";

const menuItem = "cursor-pointer gap-3 rounded-xl px-2 py-2";
const menuIconTile = "grid size-9 shrink-0 place-items-center rounded-full bg-(--chat-surface-3) text-(--chat-ink-2)";

/**
 * The top of the chat list: who you are, whether you are online, and the way into your profile and the app's
 * preferences. It reads everything itself (no props), so the chat list re-rendering never re-renders it, and its
 * own updates (presence, an open panel) never re-render the list.
 */
function SidebarHeaderComponent() {
    const { user } = useAppContext();
    const presence = useSelfPresence(user?.id);
    const [panel, setPanel] = useState<Panel | null>(null);
    const account = useAccountDetails(user?.id, panel === "profile");
    const statusId = useId();

    // A panel gives focus back to whatever opened it, so a keyboard user lands where they were.
    const profileButton = useRef<HTMLButtonElement>(null);
    const menuTrigger = useRef<HTMLButtonElement>(null);
    const opener = useRef<HTMLElement | null>(null);
    const returnFocus = useCallback((): HTMLElement | true => opener.current ?? true, []);

    const openFrom = (target: HTMLElement | null, next: Panel) => {
        opener.current = target;
        setPanel(next);
    };
    const handlePanelChange = (name: Panel) => (open: boolean) => setPanel((current) => (open ? name : current === name ? null : current));

    const displayName = user?.name?.trim() || user?.email || "Your account";

    return (
        <header className="flex h-17 shrink-0 items-center gap-2 px-3">
            {user ? (
                <button
                    ref={profileButton}
                    type="button"
                    onClick={() => openFrom(profileButton.current, "profile")}
                    aria-haspopup="dialog"
                    aria-label={`Open your profile, ${displayName}`}
                    aria-describedby={statusId}
                    className="group -ms-1 flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-2xl p-1.5 text-start outline-none transition-colors hover:bg-(--chat-surface-2) focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring) motion-reduce:transition-none"
                >
                    <span className="relative shrink-0">
                        <Avatar className="size-11 bg-(--chat-accent-soft) ring-1 ring-(--chat-line) transition-transform duration-200 group-active:scale-95 motion-reduce:transition-none">
                            <AvatarImage
                                src={user.imageUrl || undefined}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="object-cover"
                            />
                            <AvatarFallback className="bg-(--chat-accent-soft) text-sm font-semibold text-(--chat-accent-text)">{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <PresenceDot status={presence.status} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                        <span className="truncate text-base font-semibold text-(--chat-ink)">{displayName}</span>
                        <PresenceLabel id={statusId} status={presence.status} className="truncate text-[13px]" />
                    </span>
                </button>
            ) : (
                <div className="flex min-w-0 flex-1 items-center gap-3 p-1" aria-busy="true" aria-label="Loading your account">
                    <div className="chat-skeleton size-11 shrink-0 rounded-full" />
                    <div className="flex flex-col gap-2">
                        <div className="chat-skeleton h-3.5 w-28 rounded-md" />
                        <div className="chat-skeleton h-3 w-16 rounded-md" />
                    </div>
                </div>
            )}

            <DropdownMenu>
                <DropdownMenuTrigger
                    ref={menuTrigger}
                    disabled={!user}
                    aria-label="Account menu"
                    className={cn(ui.iconButton, "cursor-pointer data-popup-open:bg-(--chat-surface-3) data-popup-open:text-(--chat-ink)")}
                >
                    <MoreVerticalIcon strokeWidth={1.75} aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className={cn(ui.layer, "w-72 rounded-2xl p-1.5")}>
                    <DropdownMenuItem className={menuItem} onClick={() => openFrom(menuTrigger.current, "profile")}>
                        <span className={menuIconTile}>
                            <UserRoundIcon className="size4.5" aria-hidden="true" />
                        </span>
                        <span className="flex min-w-0 flex-col leading-tight">
                            <span className="text-sm font-medium text-(--chat-ink)">Profile info</span>
                            <span className="text-xs text-(--chat-ink-3)">Your account details</span>
                        </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className={menuItem} onClick={() => openFrom(menuTrigger.current, "preferences")}>
                        <span className={menuIconTile}>
                            <SlidersHorizontalIcon className="size4.5" aria-hidden="true" />
                        </span>
                        <span className="flex min-w-0 flex-col leading-tight">
                            <span className="text-sm font-medium text-(--chat-ink)">App preferences</span>
                            <span className="text-xs text-(--chat-ink-3)">Theme and notifications</span>
                        </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className={menuItem} >
                        <span className={menuIconTile}>
                            <UsersIcon className="size4.5" aria-hidden="true" />
                        </span>
                        <span className="flex min-w-0 flex-col leading-tight">
                            <span className="text-sm font-medium text-(--chat-ink)">Create Group</span>
                            <span className="text-xs text-(--chat-ink-3)">Talk with your friends</span>
                        </span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <ProfileSheet
                open={panel === "profile"}
                onOpenChange={handlePanelChange("profile")}
                finalFocus={returnFocus}
                user={user}
                presence={presence}
                account={account}
            />
            <PreferencesSheet
                open={panel === "preferences"}
                onOpenChange={handlePanelChange("preferences")}
                finalFocus={returnFocus}
            />
        </header>
    );
}

export const SidebarHeader = memo(SidebarHeaderComponent);
