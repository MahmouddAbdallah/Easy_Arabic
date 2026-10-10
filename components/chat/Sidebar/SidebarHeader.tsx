"use client";

import { memo, useCallback, useId, useRef, useState } from "react";
import { MoreVerticalIcon, SlidersHorizontalIcon, UserRoundIcon } from "lucide-react";
import { useAppContext } from "@/components/AppContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccountDetails } from "../hooks/useAccountDetails";
import { useSelfPresence } from "../hooks/useSelfPresence";
import { getInitials } from "../lib/initials";
import { PresenceDot, PresenceLabel } from "./PresenceDot";
import { PreferencesSheet } from "./PreferencesSheet";
import { ProfileSheet } from "./ProfileSheet";

type Panel = "profile" | "preferences";

const menuItem = "cursor-pointer gap-3 rounded-lg px-2 py-2";
const menuIconTile = "grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground";

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
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/30 bg-card/20 px-3 backdrop-blur-md">
            {user ? (
                <button
                    ref={profileButton}
                    type="button"
                    onClick={() => openFrom(profileButton.current, "profile")}
                    aria-haspopup="dialog"
                    aria-label={`Open your profile, ${displayName}`}
                    aria-describedby={statusId}
                    className="group -ms-1 flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl p-1 text-start outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
                >
                    <span className="relative shrink-0">
                        <Avatar className="size-10 shadow-sm ring-1 ring-border/50 transition-transform duration-200 group-active:scale-95 motion-reduce:transition-none">
                            <AvatarImage
                                src={user.imageUrl || undefined}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="object-cover"
                            />
                            <AvatarFallback className="text-xs font-semibold">{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <PresenceDot status={presence.status} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-semibold tracking-tight text-foreground">{displayName}</span>
                        <PresenceLabel id={statusId} status={presence.status} className="truncate text-[11px] font-medium" />
                    </span>
                </button>
            ) : (
                <div className="flex min-w-0 flex-1 items-center gap-3 p-1" aria-busy="true" aria-label="Loading your account">
                    <Skeleton className="size-10 shrink-0 rounded-full" />
                    <div className="flex flex-col gap-1.5">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-3 w-16" />
                    </div>
                </div>
            )}

            <DropdownMenu>
                <DropdownMenuTrigger
                    ref={menuTrigger}
                    disabled={!user}
                    aria-label="Account menu"
                    className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted data-popup-open:text-foreground disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"
                >
                    <MoreVerticalIcon className="size-4" aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-2xl border-border/50 p-1.5">
                    <DropdownMenuItem className={menuItem} onClick={() => openFrom(menuTrigger.current, "profile")}>
                        <span className={menuIconTile}>
                            <UserRoundIcon className="size-4" aria-hidden="true" />
                        </span>
                        <span className="flex min-w-0 flex-col leading-tight">
                            <span className="text-sm font-medium text-foreground">Profile info</span>
                            <span className="text-xs text-muted-foreground">Your account details</span>
                        </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className={menuItem} onClick={() => openFrom(menuTrigger.current, "preferences")}>
                        <span className={menuIconTile}>
                            <SlidersHorizontalIcon className="size-4" aria-hidden="true" />
                        </span>
                        <span className="flex min-w-0 flex-col leading-tight">
                            <span className="text-sm font-medium text-foreground">App preferences</span>
                            <span className="text-xs text-muted-foreground">Theme and notifications</span>
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
