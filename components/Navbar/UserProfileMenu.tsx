'use client'

import Link from "next/link"
import { ChevronDown, KeyRound, LoaderCircle, LogOut, UserRound } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { userType } from "@/types/userTypes"
import { focusRing } from "./styles"
import { UserAvatar } from "./UserAvatar"

interface UserProfileMenuProps {
    user: userType
    onLogout: () => void
    loggingOut?: boolean
}

export const UserProfileMenu = ({ user, onLogout, loggingOut = false }: UserProfileMenuProps) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                aria-label={`Account menu for ${user.name}`}
                className={`group flex h-10 cursor-pointer items-center gap-2.5 rounded-full ps-1 pe-1 text-start transition-colors hover:bg-muted aria-expanded:bg-muted motion-reduce:transition-none lg:pe-3 ${focusRing}`}
            >
                <UserAvatar name={user.name} className="size-8 text-xs" />
                <span className="hidden min-w-0 leading-tight lg:block">
                    <span className="block max-w-32 truncate text-sm font-medium text-foreground">{user.name}</span>
                    <span className="block text-xs capitalize text-muted-foreground">{user.role}</span>
                </span>
                <ChevronDown
                    aria-hidden
                    className="hidden size-4 text-muted-foreground transition-transform duration-200 group-aria-expanded:rotate-180 motion-reduce:transition-none lg:block"
                />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" sideOffset={10} className="w-64 rounded-xl p-1.5">
                <div className="flex items-center gap-3 px-2 py-2.5">
                    <UserAvatar name={user.name} className="size-11 text-sm" />
                    <div className="min-w-0 leading-tight">
                        <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
                        {user.email && <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>}
                        <p className="mt-1.5 inline-block rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium capitalize text-brand">
                            {user.role}
                        </p>
                    </div>
                </div>

                <DropdownMenuSeparator />

                {user.role === "family" && (
                    <DropdownMenuItem render={<Link href="/profile" />} className="cursor-pointer gap-2.5 px-2.5 py-2">
                        <UserRound aria-hidden />
                        Profile
                    </DropdownMenuItem>
                )}

                <DropdownMenuItem render={<Link href="/change-password" />} className="cursor-pointer gap-2.5 px-2.5 py-2">
                    <KeyRound aria-hidden />
                    Change password
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                    variant="destructive"
                    disabled={loggingOut}
                    onClick={onLogout}
                    className="cursor-pointer gap-2.5 px-2.5 py-2"
                >
                    {loggingOut ? <LoaderCircle aria-hidden className="animate-spin" /> : <LogOut aria-hidden />}
                    {loggingOut ? "Signing out…" : "Sign out"}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
