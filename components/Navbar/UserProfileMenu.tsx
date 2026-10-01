'use client'

import { useState } from "react"
import { LogOut, ChevronDown, ShieldCheck } from "lucide-react"
import clsx from "clsx"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface UserProfileMenuProps {
    user: any
    onLogout: () => void
}

export const UserProfileMenu = ({ user, onLogout }: UserProfileMenuProps) => {
    const [open, setOpen] = useState(false)

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger className="focus:outline-none">
                <div className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-full sm:rounded-2xl bg-card/80 border border-border/80 hover:border-primary/40 hover:bg-card transition-all shadow-xs group cursor-pointer">
                    <div className="relative text-xs font-black bg-primary text-primary-foreground w-8 h-8 sm:w-9 sm:h-9 flex justify-center items-center rounded-full sm:rounded-xl shrink-0 shadow-sm transition-transform group-hover:scale-105">
                        {user?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left hidden md:block max-w-30">
                        <p className="text-xs font-extrabold truncate text-foreground leading-tight">
                            {user?.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground capitalize font-medium">
                            {user?.role || 'User'}
                        </p>
                    </div>
                    <ChevronDown className={clsx("w-4 h-4 text-muted-foreground transition-transform duration-200 hidden md:block", open && "rotate-180")} />
                </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                sideOffset={12}
                className="w-56 rounded-2xl bg-card/95 border border-border/90 backdrop-blur-2xl shadow-2xl p-2 z-50"
            >
                <div className="p-3 mb-1 rounded-xl bg-primary/5 border border-primary/10 flex items-center gap-3">
                    <div className="text-sm font-black bg-primary text-primary-foreground w-9 h-9 flex justify-center items-center rounded-xl shrink-0">
                        {user?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs font-extrabold text-foreground truncate">{user?.name}</span>
                        <span className="text-[10px] text-primary font-bold capitalize flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            {user?.role || 'Member'}
                        </span>
                    </div>
                </div>

                <DropdownMenuItem
                    onClick={onLogout}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-bold text-destructive focus:text-destructive hover:bg-destructive/10 focus:bg-destructive/10 rounded-xl cursor-pointer"
                >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}