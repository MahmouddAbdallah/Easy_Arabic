"use client";

import React from "react";
import Link from "next/link";
import { ChevronDown, Globe, KeyRound, LoaderCircle, LogOut } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppContext } from "@/components/AppContext";
import { useLogout } from "./useLogout";

function getInitials(name: string | undefined): string {
    const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "A";
    const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0];
    return letters.toUpperCase();
}

function Avatar({ name, className }: { name?: string; className: string }) {
    return (
        <span
            aria-hidden
            className={`grid shrink-0 place-items-center rounded-lg bg-brand-soft font-semibold text-brand ring-1 ring-brand/20 ${className}`}
        >
            {getInitials(name)}
        </span>
    );
}

/** Signed-in admin: who they are, a few useful destinations, and sign out. */
export function UserMenu() {
    const { user } = useAppContext();
    const { logout, pending } = useLogout();

    const name = user?.name || "Admin";
    const email = user?.email;
    const role = user?.role ?? "admin";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                aria-label={`Account menu for ${name}`}
                className="flex h-10 items-center gap-2.5 rounded-lg ps-1 pe-1 text-start outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand/50 aria-expanded:bg-muted md:pe-2"
            >
                <Avatar name={name} className="size-8 text-xs" />
                <span className="hidden min-w-0 leading-tight md:block">
                    <span className="block max-w-36 truncate text-sm font-medium">{name}</span>
                    <span className="block text-xs capitalize text-muted-foreground">{role}</span>
                </span>
                <ChevronDown aria-hidden className="hidden size-4 text-muted-foreground md:block" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" sideOffset={8} className="w-64">
                <div className="flex items-center gap-3 px-2 py-2.5">
                    <Avatar name={name} className="size-10 text-sm" />
                    <div className="min-w-0 leading-tight">
                        <p className="truncate text-sm font-semibold">{name}</p>
                        {email && <p className="mt-0.5 truncate text-xs text-muted-foreground">{email}</p>}
                        <p className="mt-1 inline-block rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium capitalize text-brand">
                            {role}
                        </p>
                    </div>
                </div>

                <DropdownMenuSeparator />

                <DropdownMenuItem render={<Link href="/" />} className="cursor-pointer gap-2.5 px-2 py-2">
                    <Globe aria-hidden />
                    Back to website
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/change-password" />} className="cursor-pointer gap-2.5 px-2 py-2">
                    <KeyRound aria-hidden />
                    Change password
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                    variant="destructive"
                    disabled={pending}
                    onClick={() => void logout()}
                    className="cursor-pointer gap-2.5 px-2 py-2"
                >
                    {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <LogOut aria-hidden />}
                    {pending ? "Signing out…" : "Sign out"}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
