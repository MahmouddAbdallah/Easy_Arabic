"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Globe, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from 'cn'
import { LogoIcon } from "@/components/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getActiveSubHref, isItemActive, navigationItems, type NavItem } from "./navigation";
import { useSidebarCollapsed } from "./useSidebarCollapsed";
import { usePendingCommentCount } from "@/components/blog/dashboard/hooks/usePendingCommentCount";
import { UNREAD_MESSAGES_COLLECTION, useUnreadCount } from "./useUnreadCount";

interface SidebarProps {
    /** `desktop`: sticky rail that can collapse. `drawer`: always expanded, fills its container. */
    variant?: "desktop" | "drawer";
    /** Called after any navigation, so a drawer can close itself. */
    onNavigate?: () => void;
    /** Extra control at the end of the header row (the drawer's close button). */
    headerAction?: React.ReactNode;
    className?: string;
}

/* ── Shared row styling ─────────────────────────────────────────────────── */

const ROW =
    "group/row relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-brand/50";
const ROW_IDLE = "text-muted-foreground hover:bg-muted hover:text-foreground";
const ROW_ACTIVE = "bg-brand-soft text-brand";
/** Thin gold marker on the leading edge of the current page. */
const ROW_MARKER =
    "before:absolute before:inset-y-2 before:-start-3 before:w-[3px] before:rounded-e-full before:bg-gold before:content-['']";

function rowClass(active: boolean, collapsed: boolean, extra?: string) {
    return cn(ROW, active ? cn(ROW_ACTIVE, ROW_MARKER) : ROW_IDLE, collapsed && "justify-center px-0", extra);
}

/** Unread pill. In the collapsed rail it becomes a dot on the icon. `noun` is what the number counts, for screen readers. */
function Counter({ count, collapsed, noun = "unread" }: { count: number; collapsed: boolean; noun?: string }) {
    if (count <= 0) return null;
    const label = count > 99 ? "99+" : String(count);
    if (collapsed) {
        return (
            <span
                aria-hidden
                className="absolute end-2.5 top-2 size-2 rounded-full bg-destructive ring-2 ring-card"
            />
        );
    }
    return (
        <span
            className="ms-auto grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1.5 text-xs font-semibold tabular-nums text-destructive-foreground"
            aria-label={`${count} ${noun}`}
        >
            {label}
        </span>
    );
}

/** Wraps a collapsed-rail control in a tooltip so its name is still discoverable. */
function RailTooltip({
    label,
    enabled,
    children,
}: {
    label: string;
    enabled: boolean;
    children: React.ReactElement<Record<string, unknown>>;
}) {
    if (!enabled) return children;
    return (
        <Tooltip>
            <TooltipTrigger render={children} />
            <TooltipContent side="right" sideOffset={10}>
                {label}
            </TooltipContent>
        </Tooltip>
    );
}

/* ── Navigation items ───────────────────────────────────────────────────── */

interface ItemProps {
    item: NavItem;
    pathname: string;
    collapsed: boolean;
    chatUnread: number;
    /** Comments waiting for review (the Blog group's counter). */
    pendingComments: number;
    open: boolean;
    onToggle: () => void;
    onNavigate?: () => void;
}

function NavLeaf({ item, pathname, collapsed, chatUnread, onNavigate }: Omit<ItemProps, "open" | "onToggle" | "pendingComments">) {
    const active = isItemActive(item, pathname);
    const Icon = item.icon;
    const count = item.counter === "chat" ? chatUnread : 0;

    return (
        <RailTooltip label={item.title} enabled={collapsed}>
            <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={rowClass(active, collapsed)}
            >
                <Icon className="size-4.5 shrink-0" aria-hidden />
                <span className={cn("truncate", collapsed && "sr-only")}>{item.title}</span>
                <Counter count={count} collapsed={collapsed} />
            </Link>
        </RailTooltip>
    );
}

function NavGroup({ item, pathname, collapsed, pendingComments, open, onToggle, onNavigate }: Omit<ItemProps, "chatUnread">) {
    const activeSub = getActiveSubHref(item, pathname);
    const countFor = (counter: "blogComments" | "chat" | undefined) => (counter === "blogComments" ? pendingComments : 0);
    const groupCount = countFor(item.counter);
    const active = activeSub !== null;
    const Icon = item.icon;
    const subs = item.subItems ?? [];
    const panelId = `nav-group-${item.title.toLowerCase().replace(/\s+/g, "-")}`;

    /* Collapsed rail: the group opens as a flyout menu next to the icon. */
    if (collapsed) {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger
                    aria-label={item.title}
                    className={rowClass(active, true, "cursor-pointer aria-expanded:bg-muted aria-expanded:text-foreground")}
                >
                    <Icon className="size-4.5 shrink-0" aria-hidden />
                    <Counter count={groupCount} collapsed noun="pending" />
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" sideOffset={10} className="w-52">
                    <DropdownMenuGroup>
                        <DropdownMenuLabel className="px-2 py-1.5">{item.title}</DropdownMenuLabel>
                        {subs.map((sub) => (
                            <DropdownMenuItem
                                key={sub.href}
                                render={<Link href={sub.href} onClick={onNavigate} />}
                                className={cn(
                                    "cursor-pointer px-2 py-2",
                                    sub.href === activeSub && "bg-brand-soft font-medium text-brand"
                                )}
                            >
                                {sub.title}
                                <Counter count={countFor(sub.counter)} collapsed={false} noun="pending" />
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    /* While the group is open, its active child carries the highlight; the parent only
       takes the highlight when the group is folded and the current page is hidden inside. */
    const highlightParent = active && !open;

    return (
        <div>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                aria-controls={panelId}
                className={rowClass(highlightParent, false, cn("cursor-pointer", active && open && "text-foreground"))}
            >
                <Icon className={cn("size-4.5 shrink-0", active && open && "text-brand")} aria-hidden />
                <span className="flex-1 truncate text-start">{item.title}</span>
                {/* While the group is open its sub-pages carry their own counters. */}
                {!open && <Counter count={groupCount} collapsed={false} noun="pending" />}
                <ChevronDown
                    aria-hidden
                    className={cn(
                        "size-4 shrink-0 opacity-60 transition-transform duration-200 motion-reduce:transition-none",
                        open && "rotate-180"
                    )}
                />
            </button>

            <div
                id={panelId}
                inert={!open}
                className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
            >
                <ul className="ms-5.5 min-h-0 space-y-0.5 overflow-hidden border-s border-border ps-3">
                    <li aria-hidden className="h-1" />
                    {subs.map((sub) => {
                        const subActive = sub.href === activeSub;
                        return (
                            <li key={sub.href}>
                                <Link
                                    href={sub.href}
                                    onClick={onNavigate}
                                    aria-current={subActive ? "page" : undefined}
                                    className={cn(
                                        "flex h-9 items-center rounded-lg px-3 text-sm outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/50",
                                        subActive
                                            ? "bg-brand-soft font-medium text-brand"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <span className="truncate">{sub.title}</span>
                                    <Counter count={countFor(sub.counter)} collapsed={false} noun="pending" />
                                </Link>
                            </li>
                        );
                    })}
                    <li aria-hidden className="h-0.5" />
                </ul>
            </div>
        </div>
    );
}

/* ── Sidebar ────────────────────────────────────────────────────────────── */

export function Sidebar({ variant = "desktop", onNavigate, headerAction, className }: SidebarProps) {
    const pathname = usePathname();
    const [storedCollapsed, setStoredCollapsed] = useSidebarCollapsed();
    const chatUnread = useUnreadCount(UNREAD_MESSAGES_COLLECTION);
    const pendingComments = usePendingCommentCount();

    const isDrawer = variant === "drawer";
    const collapsed = !isDrawer && storedCollapsed;

    // Width only animates once the user has toggled it, not while restoring the saved state on load.
    const [animateWidth, setAnimateWidth] = useState(false);

    /* A group follows the current page (open when it contains it) until the user toggles it by hand;
       that choice then lasts for the current page only. */
    const [overrides, setOverrides] = useState<Record<string, { path: string; open: boolean }>>({});
    const isGroupOpen = (item: NavItem) => {
        const override = overrides[item.title];
        if (override && override.path === pathname) return override.open;
        return getActiveSubHref(item, pathname) !== null;
    };
    const toggleGroup = (item: NavItem) =>
        setOverrides((prev) => ({ ...prev, [item.title]: { path: pathname, open: !isGroupOpen(item) } }));

    const toggleCollapsed = () => {
        setAnimateWidth(true);
        setStoredCollapsed(!storedCollapsed);
    };

    return (
        <TooltipProvider delay={150}>
            <aside
                aria-label="Dashboard sidebar"
                data-collapsed={collapsed}
                className={cn(
                    "flex-col bg-card text-card-foreground select-none",
                    isDrawer
                        ? "flex h-full w-full"
                        : cn(
                            "sticky top-0 hidden h-dvh shrink-0 border-e border-border lg:flex",
                            collapsed ? "w-18" : "w-64",
                            animateWidth && "transition-[width] duration-200 ease-out motion-reduce:transition-none"
                        ),
                    className
                )}
            >
                {/* Brand row. Same height as the navbar so the two borders line up. */}
                <div
                    className={cn(
                        "flex h-16 shrink-0 items-center gap-2 border-b border-border",
                        collapsed ? "justify-center px-2" : "px-4"
                    )}
                >
                    <Link
                        href="/dashboard"
                        onClick={onNavigate}
                        aria-label="Easy Arabic — dashboard home"
                        className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                    >
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft ring-1 ring-brand/15">
                            <LogoIcon className="h-4.5 w-5.5 fill-brand stroke-brand" />
                        </span>
                        {!collapsed && (
                            <span className="min-w-0 leading-tight">
                                <span className="block truncate text-sm font-semibold tracking-tight">Easy Arabic</span>
                                <span className="block truncate text-xs text-muted-foreground">Admin dashboard</span>
                            </span>
                        )}
                    </Link>
                    {headerAction && <div className="ms-auto shrink-0">{headerAction}</div>}
                </div>

                {/* Navigation. Scrolls on its own, so short screens never push the footer away. */}
                <nav aria-label="Dashboard" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
                    {collapsed ? (
                        <div aria-hidden className="mx-2 mb-3 h-px bg-border" />
                    ) : (
                        <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Manage
                        </p>
                    )}
                    <ul className="space-y-1">
                        {navigationItems.map((item) => (
                            <li key={item.title}>
                                {item.subItems?.length ? (
                                    <NavGroup
                                        item={item}
                                        pathname={pathname}
                                        collapsed={collapsed}
                                        pendingComments={pendingComments}
                                        open={isGroupOpen(item)}
                                        onToggle={() => toggleGroup(item)}
                                        onNavigate={onNavigate}
                                    />
                                ) : (
                                    <NavLeaf
                                        item={item}
                                        pathname={pathname}
                                        collapsed={collapsed}
                                        chatUnread={chatUnread}
                                        onNavigate={onNavigate}
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Footer: way back to the public site, and the collapse control. */}
                <div className="shrink-0 space-y-1 border-t border-border p-3">
                    <RailTooltip label="Back to website" enabled={collapsed}>
                        <Link href="/" onClick={onNavigate} className={rowClass(false, collapsed)}>
                            <Globe className="size-4.5 shrink-0" aria-hidden />
                            <span className={cn("truncate", collapsed && "sr-only")}>Back to website</span>
                        </Link>
                    </RailTooltip>

                    {!isDrawer && (
                        <RailTooltip label="Expand sidebar" enabled={collapsed}>
                            <button
                                type="button"
                                onClick={toggleCollapsed}
                                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                                className={rowClass(false, collapsed, "cursor-pointer")}
                            >
                                {collapsed ? (
                                    <PanelLeftOpen className="size-4.5 shrink-0" aria-hidden />
                                ) : (
                                    <PanelLeftClose className="size-4.5 shrink-0" aria-hidden />
                                )}
                                {!collapsed && <span className="truncate">Collapse</span>}
                            </button>
                        </RailTooltip>
                    )}
                </div>
            </aside>
        </TooltipProvider>
    );
}
