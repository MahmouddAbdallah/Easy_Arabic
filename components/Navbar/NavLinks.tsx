'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, Home, LayoutDashboard, Mail, MessageSquare, type LucideIcon } from "lucide-react"
import UnReadMsgCount from "../chat/UnreadMsgCount"
import { cn } from "@/lib/utils"
import type { userType } from "@/types/userTypes"
import { focusRing } from "./styles"

interface NavLinksProps {
    user: userType | null | undefined
    onItemClick?: () => void
    variant?: 'desktop' | 'mobile'
}

interface NavItem {
    label: string
    href: string
    icon: LucideIcon
    visible: boolean
    /** Shows the live unread-message count next to the label. */
    unread?: boolean
}

/** Which links a visitor sees, by sign-in state and role. */
const getNavItems = (user: NavLinksProps['user']): NavItem[] => [
    { label: "Home", href: "/", icon: Home, visible: true },
    { label: "Contact", href: "/contact", icon: Mail, visible: !user },
    { label: "Lessons", href: "/lesson", icon: BookOpen, visible: user?.role === 'teacher' || user?.role === 'admin' },
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, visible: user?.role === 'admin' },
    { label: "Chat", href: "/chat", icon: MessageSquare, visible: !!user, unread: true },
]

/** `/lesson` is active on `/lesson` and anything under it, but never on `/lessons-archive`. */
const isActive = (pathname: string, href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)

/**
 * The unread counter positions itself absolutely (top-right corner of the nearest positioned
 * ancestor). Inside a nav link that would sit on top of the label, so this wrapper turns it into a
 * normal inline pill instead. `empty:hidden` drops the wrapper while there is nothing to show.
 */
const UnreadSlot = ({ className }: { className?: string }) => (
    <span className={cn("empty:hidden [&>*]:static! [&>*]:w-auto! [&>*]:min-w-5! [&>*]:px-1.5!", className)}>
        <UnReadMsgCount />
    </span>
)

export const NavLinks = ({ user, onItemClick, variant = 'desktop' }: NavLinksProps) => {
    const pathname = usePathname() ?? ""
    const isMobile = variant === 'mobile'
    const items = getNavItems(user).filter((item) => item.visible)

    return (
        <ul className={isMobile ? "space-y-1" : "flex items-center gap-1"}>
            {items.map(({ label, href, icon: Icon, unread }) => {
                const active = isActive(pathname, href)

                return (
                    <li key={href}>
                        <Link
                            href={href}
                            onClick={onItemClick}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                "relative flex items-center transition-colors duration-150 motion-reduce:transition-none",
                                focusRing,
                                isMobile
                                    ? cn(
                                          "h-12 w-full gap-3 rounded-lg px-3 text-[0.9375rem] font-medium",
                                          active
                                              ? // Gold marker on the leading edge, as in the dashboard sidebar.
                                                "bg-brand-soft text-brand before:absolute before:inset-y-2.5 before:-start-4 before:w-[3px] before:rounded-e-full before:bg-gold before:content-['']"
                                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                      )
                                    : cn(
                                          "h-9 gap-1.5 rounded-lg px-3.5 text-sm font-medium",
                                          // Gold marker that sits on the header's bottom border (header is 64px, link 36px).
                                          "after:pointer-events-none after:absolute after:inset-x-3.5 after:-bottom-[15px] after:h-0.5 after:rounded-full after:bg-gold after:content-[''] after:transition-transform after:duration-200 motion-reduce:after:transition-none",
                                          active
                                              ? "text-brand after:scale-x-100"
                                              : "text-muted-foreground after:scale-x-0 hover:bg-muted hover:text-foreground"
                                      )
                            )}
                        >
                            {isMobile && <Icon aria-hidden className="size-5 shrink-0" />}
                            <span className={isMobile ? "flex-1 truncate" : undefined}>{label}</span>
                            {unread && <UnreadSlot className={isMobile ? undefined : "ms-0.5"} />}
                        </Link>
                    </li>
                )
            })}
        </ul>
    )
}
