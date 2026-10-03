"use client";

import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Globe, KeyRound, Moon, Search, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import { useTheme } from "@/lib/theme";
import { navigationItems } from "./navigation";

const noopSubscribe = () => () => {};
const detectMac = () => /Mac|iPhone|iPad/i.test(navigator.platform);

/** The key that opens the menu, as this platform names it. */
function useModifierKeyLabel() {
    const isMac = useSyncExternalStore(noopSubscribe, detectMac, () => false);
    return isMac ? "⌘" : "Ctrl";
}

interface PageEntry {
    key: string;
    label: string;
    context?: string;
    href: string;
    icon: React.ElementType;
}

/** Every page in the navigation, one entry per link. */
const PAGES: PageEntry[] = navigationItems.flatMap((item): PageEntry[] => {
    if (!item.subItems?.length) {
        return [{ key: item.href, label: item.title, href: item.href, icon: item.icon }];
    }
    return item.subItems.map((sub) => ({
        key: sub.href,
        label: sub.title,
        context: item.title,
        href: sub.href,
        icon: item.icon,
    }));
});

/**
 * Quick-jump menu (⌘K / Ctrl K): type a page name, press Enter. Replaces the search box that
 * used to sit in the navbar but searched nothing.
 */
export function CommandMenu() {
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const [open, setOpen] = useState(false);
    const modifier = useModifierKeyLabel();

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setOpen((current) => !current);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    const run = useCallback((action: () => void) => {
        setOpen(false);
        action();
    }, []);

    const goTo = (href: string) => run(() => router.push(href));

    return (
        <>
            {/* Wide trigger from `md`; a plain icon button on phones. */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Search pages"
                aria-keyshortcuts="Control+K Meta+K"
                className="hidden h-9 w-56 items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/50 md:flex lg:w-72"
            >
                <Search aria-hidden className="size-4 shrink-0" />
                <span className="flex-1 truncate text-start">Search pages…</span>
                <kbd className="pointer-events-none rounded border border-border bg-background px-1.5 py-0.5 font-sans text-xs text-muted-foreground">
                    {modifier} K
                </kbd>
            </button>
            <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                onClick={() => setOpen(true)}
                aria-label="Search pages"
                className="md:hidden"
            >
                <Search aria-hidden />
            </Button>

            <CommandDialog
                open={open}
                onOpenChange={setOpen}
                title="Search"
                description="Jump to a dashboard page or run an action."
            >
                {/* This project's CommandDialog doesn't add cmdk's root, so it is wrapped here. */}
                <Command>
                    <CommandInput placeholder="Jump to a page or action…" />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>

                        <CommandGroup heading="Pages">
                            {PAGES.map((page) => {
                                const Icon = page.icon;
                                return (
                                    <CommandItem
                                        key={page.key}
                                        value={`${page.context ?? ""} ${page.label}`}
                                        onSelect={() => goTo(page.href)}
                                    >
                                        <Icon aria-hidden />
                                        <span>{page.label}</span>
                                        {page.context && (
                                            <span className="text-xs text-muted-foreground">in {page.context}</span>
                                        )}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>

                        <CommandSeparator />

                        <CommandGroup heading="Actions">
                            <CommandItem value="back to website home" onSelect={() => goTo("/")}>
                                <Globe aria-hidden />
                                <span>Back to website</span>
                            </CommandItem>
                            <CommandItem value="change password" onSelect={() => goTo("/change-password")}>
                                <KeyRound aria-hidden />
                                <span>Change password</span>
                            </CommandItem>
                            <CommandItem value="switch theme dark light mode" onSelect={() => run(toggleTheme)}>
                                {theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
                                <span>{theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}</span>
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>

                    <div className="flex items-center justify-end gap-1.5 border-t border-border px-3 py-2 text-xs text-muted-foreground">
                        <CornerDownLeft aria-hidden className="size-3.5" />
                        <span>to open</span>
                        <span aria-hidden>·</span>
                        <kbd className="font-sans">Esc</kbd>
                        <span>to close</span>
                    </div>
                </Command>
            </CommandDialog>
        </>
    );
}
