"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import NotificationBody from "@/components/notification/NotificationBody";
import { UNREAD_COUNT_COLLECTION } from "@/components/notification/lib/contract";
import { cn } from "cn";
import { useUnreadCount } from "../dashboard/Navbar/useUnreadCount";

/**
 * Bell with a live unread dot. Opens the in-app notification list in a popover.
 * The list is only mounted while the popover is open, so it costs nothing otherwise.
 */
export function NotificationsMenu() {
    const pathname = usePathname();
    const unread = useUnreadCount(UNREAD_COUNT_COLLECTION);
    const { push } = useRouter();

    return (
        <Popover key={pathname}>
            <Button
                onClick={() => { push('/notification') }}
                variant={'ghost'}
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
                className={cn("md:hidden flex justify-center items-center cursor-pointer relative aria-expanded:bg-muted")}
            >
                <Bell aria-hidden />
                {unread > 0 && (
                    <span
                        aria-hidden
                        className="absolute end-1.5 top-1.5 size-2.5 rounded-full bg-destructive ring-2 ring-card"
                    />
                )}
            </Button>
            <PopoverTrigger
                disabled={pathname == '/notification'}
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
                className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "hidden md:flex justify-center items-center relative aria-expanded:bg-muted")}
            >
                <Bell aria-hidden />
                {unread > 0 && (
                    <span
                        aria-hidden
                        className="absolute cursor-pointer end-1.5 top-1.5 size-2.5 rounded-full bg-destructive ring-2 ring-card"
                    />
                )}
            </PopoverTrigger>

            <PopoverContent
                align="end"
                sideOffset={8}
                className="w-[min(26rem,calc(100vw-1.5rem))] gap-0 p-0"
            >
                <div className="max-h-[min(30rem,70dvh)] overflow-y-auto overscroll-contain">
                    <NotificationBody pageSize={8} className="max-w-none p-3" />
                </div>
                <div className="border-t border-border p-1.5">
                    <Link
                        href="/notification"
                        className="flex h-9 items-center justify-center rounded-md text-sm font-medium text-brand outline-none transition-colors hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand/50"
                    >
                        View all notifications
                    </Link>
                </div>
            </PopoverContent>
        </Popover>
    );
}
