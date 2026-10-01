'use client'

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import clsx from "clsx"
import { Home, MailIcon, MessagesCircleIcon, PlusCircle, LayoutDashboard } from "lucide-react"
import UnReadMsgCount from "../chat/UnreadMsgCount"

interface NavLinksProps {
    user: any
    onItemClick?: () => void
    variant?: 'desktop' | 'mobile'
}

export const NavLinks = ({ user, onItemClick, variant = 'desktop' }: NavLinksProps) => {
    const pathname = usePathname()

    const isActive = (href: string) => {
        return href === "/" ? pathname === "/" : pathname.includes(href.replace('/', ''))
    }

    const links = [
        {
            label: "Home",
            href: "/",
            show: true,
            icon: <Home className="w-4 h-4 shrink-0" />,
            badge: null
        },
        {
            label: "Contact",
            href: "/contact",
            show: !user,
            icon: <MailIcon className="w-4 h-4 shrink-0" />,
            badge: null
        },
        {
            label: "Lessons",
            href: "/lesson",
            show: user?.role === 'teacher' || user?.role === 'admin',
            icon: <PlusCircle className="w-4 h-4 shrink-0" />,
            badge: null
        },
        {
            label: "Dashboard",
            href: "/dashboard",
            show: user?.role === 'admin',
            icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
            badge: null
        },
        {
            label: "Chat",
            href: "/chat",
            show: !!user,
            icon: <MessagesCircleIcon className="w-4 h-4 shrink-0" />,
            badge: <UnReadMsgCount />
        },
    ]

    const isMobile = variant === 'mobile'

    return (
        <>
            {links.map((link) => {
                if (!link.show) return null

                const active = isActive(link.href)

                return (
                    <div
                        key={link.href}
                        className={'relative'}
                    >
                        {link.badge}
                        <Link
                            href={link.href}
                            onClick={onItemClick}
                            className={clsx(
                                "relative transition-all duration-300 flex items-center gap-2",
                                isMobile
                                    ? "border px-4 py-3.5 rounded-2xl text-sm font-bold w-full"
                                    : "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold",
                                active
                                    ? "text-primary-foreground bg-primary shadow-md shadow-primary/25 font-extrabold"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                        >
                            {link.icon}
                            <span>{link.label}</span>
                        </Link>
                    </div>
                )
            })}
        </>
    )
}