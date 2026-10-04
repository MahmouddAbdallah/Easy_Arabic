'use client'

import Link from "next/link"
import { KeyRound, LoaderCircle, LogIn, LogOut, X } from "lucide-react"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { displayFont } from "@/lib/fonts"
import { cn } from "@/lib/utils"
import type { userType } from "@/types/userTypes"
import { Brand } from "./Brand"
import { NavLinks } from "./NavLinks"
import ThemeToggle from "./ThemeToggle"
import { UserAvatar } from "./UserAvatar"
import { focusRing, iconButtonClass } from "./styles"

interface MobileDrawerProps {
    isOpen: boolean
    onClose: () => void
    user: userType | null | undefined
    onLogout: () => void
    loggingOut?: boolean
}

const footerRow = cn(
    "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-[0.9375rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground motion-reduce:transition-none",
    focusRing
)

/**
 * Slide-in navigation for screens below `md`. Built on the shared Sheet, so it traps focus, closes
 * on Escape or an outside tap, locks page scroll and returns focus to the menu button. Its content
 * only mounts while open.
 */
export const MobileDrawer = ({ isOpen, onClose, user, onLogout, loggingOut = false }: MobileDrawerProps) => {
    const signedIn = !!user?.name

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent
                side="right"
                showCloseButton={false}
                className={cn(
                    // The Sheet renders in a portal, outside the header, so it needs the font variable itself.
                    displayFont.variable,
                    "w-80 max-w-[85vw] gap-0 border-border bg-background p-0 shadow-2xl data-[side=right]:w-80 data-[side=right]:sm:max-w-80"
                )}
            >
                <SheetTitle className="sr-only">Site navigation</SheetTitle>
                <SheetDescription className="sr-only">Pages, account and appearance settings.</SheetDescription>

                <div className="flex h-16 shrink-0 items-center justify-between border-b border-border ps-4 pe-3">
                    <Brand onClick={onClose} />
                    <SheetClose aria-label="Close navigation menu" className={iconButtonClass}>
                        <X aria-hidden className="size-5" />
                    </SheetClose>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                    {signedIn && (
                        <div className="mb-4 flex items-center gap-3 rounded-xl bg-muted/60 p-3 ring-1 ring-border">
                            <UserAvatar name={user?.name} className="size-11 text-sm" />
                            <div className="min-w-0 leading-tight">
                                <p className="truncate text-sm font-semibold text-foreground">{user?.name}</p>
                                {user?.email && <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>}
                                <p className="mt-1.5 inline-block rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium capitalize text-brand">
                                    {user?.role}
                                </p>
                            </div>
                        </div>
                    )}

                    <nav aria-label="Mobile">
                        <NavLinks user={user} onItemClick={onClose} variant="mobile" />
                    </nav>
                </div>

                <div className="shrink-0 space-y-1 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <ThemeToggle variant="switch" />

                    {signedIn ? (
                        <>
                            <Link href="/change-password" onClick={onClose} className={footerRow}>
                                <KeyRound aria-hidden className="size-5 shrink-0" />
                                Change password
                            </Link>
                            <button
                                type="button"
                                onClick={onLogout}
                                disabled={loggingOut}
                                className={cn(
                                    "mt-2 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-destructive/10 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none",
                                    focusRing
                                )}
                            >
                                {loggingOut ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <LogOut aria-hidden className="size-4" />}
                                {loggingOut ? "Signing out…" : "Sign out"}
                            </button>
                        </>
                    ) : (
                        <Link
                            href="/sign-in"
                            onClick={onClose}
                            className={cn(
                                "mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-brand-foreground shadow-xs transition-colors hover:bg-brand/90 motion-reduce:transition-none",
                                focusRing
                            )}
                        >
                            <LogIn aria-hidden className="size-4" />
                            Sign in
                        </Link>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}
