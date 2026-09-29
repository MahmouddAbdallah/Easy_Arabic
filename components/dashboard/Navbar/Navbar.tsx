"use client";

import React, { useState } from "react";
import { Search, Bell, Menu, User, LogOut, Sun, Moon, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sidebar } from "./Sidebar";

export function Navbar() {
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isDark, setIsDark] = useState(false);

    const toggleTheme = () => {
        setIsDark(!isDark);
        document.documentElement.classList.toggle("dark");
    };

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 px-4 md:px-6 backdrop-blur-md justify-between">
            {/* Search & Mobile Trigger */}
            <div className="flex lg:hidden items-center gap-4 flex-1 max-w-md">
                <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                    <SheetTrigger >
                        <Button variant="outline" size="icon" className="lg:hidden shrink-0 rounded-xl">
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">Toggle Menu</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-72 p-0 border-r">
                        <Sidebar onNavigate={() => setIsMobileOpen(false)} />
                    </SheetContent>
                </Sheet>

                {/* Search Bar with Keyboard Shortcut */}
                <div className="relative w-full hidden sm:block">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search dashboard..."
                        className="w-full pl-9 pr-12 bg-muted/30 focus-visible:bg-background transition-all rounded-xl border-muted/60"
                    />
                    <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">
                        <span className="text-xs">⌘</span>K
                    </kbd>
                </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2.5">
                {/* Dark / Light Mode Toggle */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    className="rounded-xl hover:bg-accent"
                >
                    {isDark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4" />}
                    <span className="sr-only">Toggle Theme</span>
                </Button>

                {/* Notifications */}
                <Button
                    variant="outline"
                    size="icon"
                    className="relative rounded-xl border-muted/80 bg-background hover:bg-accent"
                >
                    <Bell className="h-4 w-4" />
                    <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background animate-pulse" />
                    <span className="sr-only">Notifications</span>
                </Button>

                {/* Profile Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger >
                        <Button
                            variant="ghost"
                            className="relative h-10 flex items-center gap-3 rounded-xl px-2 hover:bg-accent/60"
                        >
                            <Avatar className="h-8 w-8 border border-primary/20">
                                <AvatarImage src="/avatar-placeholder.png" alt="User Avatar" />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                    AD
                                </AvatarFallback>
                            </Avatar>
                            <div className="hidden md:flex flex-col text-left">
                                <span className="text-xs font-bold leading-none">Admin User</span>
                                <span className="text-[10px] text-muted-foreground mt-1">Super Admin</span>
                            </div>
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-56 rounded-xl p-2 shadow-xl border">
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-semibold leading-none">Admin User</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    admin@easyarabic.com
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="rounded-lg cursor-pointer gap-2">
                            <User className="h-4 w-4" />
                            <span>Profile</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-lg cursor-pointer gap-2">
                            <Settings className="h-4 w-4" />
                            <span>Settings</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="rounded-lg cursor-pointer gap-2 text-destructive focus:text-destructive">
                            <LogOut className="h-4 w-4" />
                            <span>Log out</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}