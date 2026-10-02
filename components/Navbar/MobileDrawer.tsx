'use client'

import Link from "next/link"
import clsx from "clsx"
import { X, Sparkles, LogOut, LogIn } from "lucide-react"
import { LogoIcon } from "../icons"
import { NavLinks } from "./NavLinks"

interface MobileDrawerProps {
    isOpen: boolean
    onClose: () => void
    user: any
    onLogout: () => void
}

export const MobileDrawer = ({ isOpen, onClose, user, onLogout }: MobileDrawerProps) => {
    return (
        <>
            {/* Overlay */}
            <div
                className={clsx(
                    "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300 md:hidden",
                    isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Drawer Container */}
            <aside
                className={clsx(
                    "fixed top-0 right-0 bottom-0 z-50 w-80 max-w-[85vw] bg-background/95 border-l border-primary/20 backdrop-blur-2xl shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-in-out md:hidden",
                    isOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
                <div>
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-border/60">
                        <div className="flex items-center gap-2">
                            <LogoIcon className="w-7 h-7 sm:w-8 sm:h-8 fill-primary stroke-primary dark:fill-blue-500 dark:stroke-blue-500 transition-transform" />
                            <span className="text-sm font-black text-foreground uppercase tracking-wider">Navigation</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* User Info Mobile Card */}
                    {user?.name && (
                        <div className="p-4 mx-4 mt-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center gap-3">
                            <div className="text-sm font-black bg-primary text-primary-foreground w-11 h-11 flex justify-center items-center rounded-xl shrink-0 shadow-sm">
                                {user?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-extrabold truncate text-foreground">{user?.name}</span>
                                <span className="text-xs text-primary font-semibold capitalize flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-accent" />
                                    {user?.role || 'User'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Sidebar Links */}
                    <nav className="p-4 space-y-2">
                        <NavLinks user={user} onItemClick={onClose} variant="mobile" />
                    </nav>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-border/60 bg-card/40">
                    {user?.name ? (
                        <button
                            onClick={onLogout}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-destructive bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 rounded-2xl transition-all"
                        >
                            <LogOut className="w-4 h-4" />
                            <span>Sign Out Account</span>
                        </button>
                    ) : (
                        <Link
                            href="/sign-in"
                            onClick={onClose}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-extrabold bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl transition-all shadow-md shadow-primary/20"
                        >
                            <LogIn className="w-4 h-4" />
                            <span>Sign In</span>
                        </Link>
                    )}
                </div>
            </aside>
        </>
    )
}