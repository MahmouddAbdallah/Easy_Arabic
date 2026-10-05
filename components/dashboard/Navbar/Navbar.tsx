"use client";

import React, { useEffect, useState } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "./Breadcrumbs";
import { CommandMenu } from "./CommandMenu";
import { NotificationsMenu } from "../../NotificationsMenu";
import { Sidebar } from "./Sidebar";
import { UserMenu } from "./UserMenu";
import { usePathname } from "next/navigation";

/** Tailwind's `lg` breakpoint, where the sidebar becomes a permanent rail. */
const DESKTOP_QUERY = "(min-width: 1024px)";

function ThemeToggle() {
    const { toggleTheme } = useTheme();
    return (
        <Button type="button" variant="ghost" size="icon-lg" onClick={toggleTheme} aria-label="Toggle theme">
            {/* Both icons are always rendered; CSS picks one, so the right one shows from first paint. */}
            <Sun aria-hidden className="hidden dark:block" />
            <Moon aria-hidden className="dark:hidden" />
        </Button>
    );
}

export function Navbar() {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const pathname = usePathname();

    // Don't leave a modal drawer open over the desktop layout after the window is widened.
    useEffect(() => {
        const media = window.matchMedia(DESKTOP_QUERY);
        const onChange = (event: MediaQueryListEvent) => {
            if (event.matches) setDrawerOpen(false);
        };
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, []);

    return (
        !pathname.includes('chat') &&
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/70 sm:gap-3 sm:px-6 lg:px-8">
            {/* Menu button + slide-in sidebar, below `lg` only. */}
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetTrigger
                    aria-label="Open navigation menu"
                    className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "-ms-2 lg:hidden")}
                >
                    <Menu aria-hidden />
                </SheetTrigger>
                <SheetContent
                    side="left"
                    showCloseButton={false}
                    className="w-72 max-w-[85vw] gap-0 border-border p-0 data-[side=left]:w-72 data-[side=left]:sm:max-w-72"
                >
                    <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
                    <SheetDescription className="sr-only">Pages of the admin dashboard.</SheetDescription>
                    <Sidebar
                        variant="drawer"
                        onNavigate={() => setDrawerOpen(false)}
                        headerAction={
                            <SheetClose
                                aria-label="Close navigation menu"
                                className={buttonVariants({ variant: "ghost", size: "icon" })}
                            >
                                <X aria-hidden />
                            </SheetClose>
                        }
                    />
                </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
                <Breadcrumbs />
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                <CommandMenu />
                <ThemeToggle />
                <NotificationsMenu />
                <span aria-hidden className="mx-1 hidden h-6 w-px bg-border sm:block" />
                <UserMenu />
            </div>
        </header>
    );
}
