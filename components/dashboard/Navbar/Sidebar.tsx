"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Users,
    GraduationCap,
    BookOpen,
    MessageSquare,
    PhoneCall,
    ChevronDown,
    Sparkles,
    LayoutDashboard,
    PanelLeftClose,
    PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavSubItem {
    title: string;
    href: string;
}

interface NavItem {
    title: string;
    href: string;
    icon: React.ElementType;
    badge?: string;
    subItems?: NavSubItem[];
}

export const navigationItems: NavItem[] = [
    {
        title: "Families",
        href: "/dashboard/families",
        icon: Users,
    },
    {
        title: "Teachers",
        href: "/dashboard/teacher",
        icon: GraduationCap,
    },
    {
        title: "Lessons",
        href: "/dashboard/lessons",
        icon: BookOpen,
        subItems: [
            { title: "All Lessons", href: "/dashboard/lessons" },
            { title: "Create Lesson", href: "/dashboard/lessons/new" },
        ],
    },
    {
        title: "Chat",
        href: "/dashboard/chat",
        icon: MessageSquare,
        badge: "New",
    },
    {
        title: "Contact",
        href: "/dashboard/contact",
        icon: PhoneCall,
    },
];

interface SidebarProps {
    className?: string;
    isCollapsed?: boolean;
    setIsCollapsed?: React.Dispatch<React.SetStateAction<boolean>>;
    onNavigate?: () => void;
}

export function Sidebar({
    className,
    isCollapsed: externalIsCollapsed,
    setIsCollapsed: externalSetIsCollapsed,
    onNavigate,
}: SidebarProps) {
    const pathname = usePathname();

    const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
    const isCollapsed = externalIsCollapsed ?? internalIsCollapsed;
    const setIsCollapsed = externalSetIsCollapsed ?? setInternalIsCollapsed;

    const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);

    const toggleSubMenu = (title: string) => {
        if (isCollapsed) {
            setIsCollapsed(false);
            setOpenSubMenu(title);
            return;
        }
        setOpenSubMenu((prev) => (prev === title ? null : title));
    };
    return (
        <TooltipProvider>
            <aside
                className={cn(
                    "sticky top-0 h-svh flex flex-col justify-between border-r border-border/40 bg-background/80 backdrop-blur-2xl transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] py-4 select-none shrink-0",
                    isCollapsed ? "w-20 px-2.5" : " lg:w-72 w-full px-4",
                    className
                )}
            >
                <div className="space-y-6">
                    {/* Header & Logo */}
                    <div className="flex items-center justify-between h-10 px-2">
                        <Link
                            href="/dashboard"
                            className={cn(
                                "flex items-center gap-3 overflow-hidden transition-all duration-300",
                                isCollapsed ? "justify-center w-full" : "w-auto"
                            )}
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-tr from-primary via-primary/90 to-primary/70 text-primary-foreground shadow-md shadow-primary/20">
                                <Sparkles className="h-5 w-5 animate-pulse" />
                            </div>

                            <div
                                className={cn(
                                    "flex flex-col whitespace-nowrap transition-all duration-300",
                                    isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto"
                                )}
                            >
                                <span className="font-bold text-sm tracking-tight text-foreground">
                                    Easy Arabic
                                </span>
                                <span className="text-[10px] font-medium text-muted-foreground/80">
                                    Management Hub
                                </span>
                            </div>
                        </Link>

                        {/* Toggle Button */}
                        {!isCollapsed && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsCollapsed(true)}
                                className="hidden lg:block h-8 w-8 text-muted-foreground/70 hover:text-foreground hover:bg-accent/60 rounded-xl transition-all"
                            >
                                <PanelLeftClose className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    {/* Expand Toggle Button when collapsed */}
                    {isCollapsed && (
                        <div className="flex justify-center">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsCollapsed(false)}
                                className="h-8 w-8 text-muted-foreground/70 hover:text-foreground hover:bg-accent/60 rounded-xl transition-all"
                            >
                                <PanelLeftOpen className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    {/* Navigation Items */}
                    <nav className="space-y-1.5">
                        {navigationItems.map((item) => {
                            const hasSubItems = Boolean(item.subItems?.length);
                            const isActive =
                                pathname === item.href ||
                                (hasSubItems &&
                                    item.subItems?.some((sub) => pathname === sub.href));
                            const isSubOpen = openSubMenu === item.title;
                            const Icon = item.icon;

                            const LinkBody = (
                                <div
                                    className={cn(
                                        "group relative flex items-center h-11 rounded-2xl px-3 text-sm font-medium transition-all duration-200 cursor-pointer",
                                        isActive
                                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 font-semibold"
                                            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                                    )}
                                >
                                    <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                                        <Icon
                                            className={cn(
                                                "h-5 w-5 transition-transform duration-200 group-hover:scale-110",
                                                isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                                            )}
                                        />
                                    </div>

                                    <div
                                        className={cn(
                                            "flex flex-1 items-center justify-between ml-3 overflow-hidden whitespace-nowrap transition-all duration-300",
                                            isCollapsed ? "opacity-0 w-0 ml-0" : "opacity-100 w-auto"
                                        )}
                                    >
                                        <span className="truncate">{item.title}</span>

                                        <div className="flex items-center gap-1.5">
                                            {item.badge && (
                                                <span
                                                    className={cn(
                                                        "rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest",
                                                        isActive
                                                            ? "bg-primary-foreground/20 text-primary-foreground"
                                                            : "bg-primary/10 text-primary"
                                                    )}
                                                >
                                                    {item.badge}
                                                </span>
                                            )}

                                            {hasSubItems && (
                                                <ChevronDown
                                                    className={cn(
                                                        "h-4 w-4 transition-transform duration-300 opacity-60",
                                                        isSubOpen && "rotate-180"
                                                    )}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );

                            return (
                                <div key={item.title}>
                                    {hasSubItems ? (
                                        <div onClick={() => toggleSubMenu(item.title)}>
                                            {isCollapsed ? (
                                                <Tooltip>
                                                    <TooltipTrigger >{LinkBody}</TooltipTrigger>
                                                    <TooltipContent side="right" className="font-semibold">
                                                        {item.title}
                                                    </TooltipContent>
                                                </Tooltip>
                                            ) : (
                                                LinkBody
                                            )}
                                        </div>
                                    ) : (
                                        <Link href={item.href} onClick={onNavigate}>
                                            {isCollapsed ? (
                                                <Tooltip>
                                                    <TooltipTrigger >{LinkBody}</TooltipTrigger>
                                                    <TooltipContent side="right" className="font-semibold">
                                                        {item.title}
                                                    </TooltipContent>
                                                </Tooltip>
                                            ) : (
                                                LinkBody
                                            )}
                                        </Link>
                                    )}

                                    {/* Submenu Smooth Collapse */}
                                    {hasSubItems && !isCollapsed && (
                                        <div
                                            className={cn(
                                                "grid transition-all duration-300 ease-in-out pl-4 ml-4 border-l border-border/50",
                                                isSubOpen
                                                    ? "grid-rows-[1fr] opacity-100 my-1.5"
                                                    : "grid-rows-[0fr] opacity-0 my-0"
                                            )}
                                        >
                                            <div className="overflow-hidden space-y-1">
                                                {item.subItems?.map((sub) => {
                                                    const isSubActive = pathname === sub.href;
                                                    return (
                                                        <Link
                                                            key={sub.href}
                                                            href={sub.href}
                                                            onClick={onNavigate}
                                                            className={cn(
                                                                "flex items-center h-9 rounded-xl px-3 text-xs font-medium transition-all duration-150",
                                                                isSubActive
                                                                    ? "text-primary font-bold bg-primary/10"
                                                                    : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                                                            )}
                                                        >
                                                            <span>{sub.title}</span>
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </nav>
                </div>

                {/* Footer Status Card */}
                <div className="mt-auto px-0.5">
                    <div
                        className={cn(
                            "rounded-2xl border border-border/40 bg-linear-to-br from-accent/30 via-card to-background p-3 transition-all duration-300",
                            isCollapsed && "p-2 text-center"
                        )}
                    >
                        <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
                            <div className="rounded-xl bg-primary/10 p-2 text-primary shrink-0">
                                <LayoutDashboard className="h-4 w-4" />
                            </div>
                            <div
                                className={cn(
                                    "flex flex-col whitespace-nowrap transition-all duration-300",
                                    isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto"
                                )}
                            >
                                <p className="text-xs font-semibold">Easy Arabic v2.0</p>
                                <p className="text-[10px] text-muted-foreground">All systems active</p>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>
        </TooltipProvider>
    );
}