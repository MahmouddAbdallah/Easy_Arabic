'use client'

import { Home, PlusCircle, LayoutDashboard, UserPlus, LogOut, Menu, X, LogIn, Sparkles, ChevronDown, ShieldCheck, MailIcon, MessagesCircleIcon } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useState, useEffect } from "react"
import axios from "axios"
import { toast } from "react-hot-toast"
import clsx from "clsx"
import { LogoIcon } from "../icons"
import ThemeToggle from "./ThemeToggle"
import { useAppContext } from "@/components/AppContext"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu"

const Navbar = () => {
    const pathname = usePathname()
    const router = useRouter()
    const context = useAppContext()

    const [userMenuOpen, setUserMenuOpen] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(false)

    useEffect(() => {
        if (sidebarOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }
    }, [sidebarOpen])

    const logout = async () => {
        try {
            const { data } = await axios.get('/api/logout')
            toast.success(data?.message || 'Logged out successfully')
            context?.setUser(null)
            closeAll()
            router.push('/sign-in')
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an error')
        }
    }

    const closeAll = () => {
        setUserMenuOpen(false)
        setSidebarOpen(false)
    }

    // Navigation Links Config
    const navLinks = [
        {
            label: "Home",
            href: "/",
            show: true,
            icon: <Home className="w-4 h-4" />
        },
        {
            label: "Contact",
            href: "/contact",
            show: context?.user ? false : true,
            icon: <MailIcon className="w-4 h-4" />
        },
        {
            label: "Chat",
            href: "/chat",
            show: context?.user ? true : false,
            icon: <MessagesCircleIcon className="w-4 h-4" />
        },
        {
            label: "Lessons",
            href: "/lesson",
            show: context?.user?.role === 'teacher' || context?.user?.role === 'admin',
            icon: <PlusCircle className="w-4 h-4" />
        },
        {
            label: "Dashboard",
            href: "/dashboard",
            show: context?.user?.role === 'admin',
            icon: <LayoutDashboard className="w-4 h-4" />
        },
        {
            label: "Sign Up",
            href: "/sign-up",
            show: context?.user?.role === 'admin',
            icon: <UserPlus className="w-4 h-4" />
        },
    ]

    const isActive = (href: string) => {
        return href === "/" ? pathname === "/" : pathname.includes(href.replace('/', ''))
    }

    return (
        <>
            {/* Header / Navbar */}
            <header className="sticky top-0 z-50 w-full bg-background/70 backdrop-blur-xl border-b border-border/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-all">

                {/* Ambient Top Glow Line */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-transparent via-primary/50 to-transparent" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16 sm:h-20">

                        {/* Left Section: Logo & Brand */}
                        <div className="flex items-center">
                            <Link
                                href={'/'}
                                onClick={closeAll}
                                className="flex items-center gap-3 group focus:outline-none"
                            >
                                <div className="relative p-2 rounded-2xl bg-primary/10 border border-primary/20 text-primary transition-all duration-300 group-hover:scale-105 group-hover:bg-primary/20 group-hover:shadow-[0_0_20px_rgba(var(--primary),0.3)]">
                                    <LogoIcon className="w-7 h-7 sm:w-8 sm:h-8 fill-primary stroke-primary dark:fill-blue-500 dark:stroke-blue-500 transition-transform" />
                                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                                    </span>
                                </div>
                            </Link>
                        </div>

                        {/* Right Section: Desktop Links + Theme + User Profile + Mobile Trigger */}
                        <div className="flex items-center gap-3 sm:gap-5">

                            {/* Desktop Nav Links */}
                            <nav className="hidden md:flex items-center gap-1.5 p-1.5 rounded-2xl bg-card/60 border border-border/60 backdrop-blur-md">
                                {navLinks.map((link) =>
                                    link.show ? (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            className={clsx(
                                                "relative px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center gap-2",
                                                isActive(link.href)
                                                    ? "text-primary-foreground bg-primary shadow-md shadow-primary/25 font-extrabold"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                            )}
                                        >
                                            {link.icon}
                                            <span>{link.label}</span>
                                        </Link>
                                    ) : null
                                )}
                            </nav>

                            {/* Theme Toggle Button */}
                            <div className="p-1 rounded-xl bg-card/60 border border-border/60 backdrop-blur-md">
                                <ThemeToggle />
                            </div>

                            {/* User Profile / Auth State */}
                            {context?.user?.name ? (
                                <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
                                    <DropdownMenuTrigger>
                                        <div
                                            className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-full sm:rounded-2xl bg-card/80 border border-border/80 hover:border-primary/40 hover:bg-card transition-all focus:outline-none shadow-xs group"
                                        >
                                            <div className="relative text-xs font-black bg-primary text-primary-foreground w-8 h-8 sm:w-9 sm:h-9 flex justify-center items-center rounded-full sm:rounded-xl shrink-0 shadow-sm transition-transform group-hover:scale-105">
                                                {context?.user?.name?.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="text-left hidden md:block max-w-30">
                                                <p className="text-xs font-extrabold truncate text-foreground leading-tight">
                                                    {context?.user?.name}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground capitalize font-medium">
                                                    {context?.user?.role || 'User'}
                                                </p>
                                            </div>
                                            <ChevronDown className={clsx("w-4 h-4 text-muted-foreground transition-transform duration-200 hidden md:block", userMenuOpen && "rotate-180")} />
                                        </div>
                                    </DropdownMenuTrigger>

                                    <DropdownMenuContent
                                        align="end"
                                        sideOffset={12}
                                        className="w-56 rounded-2xl bg-card/95 border border-border/90 backdrop-blur-2xl shadow-2xl p-2"
                                    >
                                        {/* Dropdown Header User Card */}
                                        <div className="p-3 mb-1 rounded-xl bg-primary/5 border border-primary/10 flex items-center gap-3">
                                            <div className="text-sm font-black bg-primary text-primary-foreground w-9 h-9 flex justify-center items-center rounded-xl shrink-0">
                                                {context?.user?.name?.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-xs font-extrabold text-foreground truncate">{context?.user?.name}</span>
                                                <span className="text-[10px] text-primary font-bold capitalize flex items-center gap-1">
                                                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                                    {context?.user?.role || 'Member'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Logout Option */}
                                        <DropdownMenuItem
                                            onClick={logout}
                                            className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-bold text-destructive focus:text-destructive hover:bg-destructive/10 focus:bg-destructive/10 rounded-xl cursor-pointer"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            <span>Sign Out</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            ) : (
                                <Link
                                    href={'/sign-in'}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-extrabold bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl transition-all shadow-md shadow-primary/20 scale-100 hover:scale-[1.02]"
                                >
                                    <LogIn className="w-4 h-4" />
                                    <span>Sign In</span>
                                </Link>
                            )}

                            {/* Mobile Hamburger Button */}
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="p-2.5 rounded-2xl bg-card/80 border border-border/80 text-muted-foreground hover:text-foreground hover:bg-card md:hidden transition-all"
                                aria-label="Open Navigation Menu"
                            >
                                <Menu className="w-5 h-5" />
                            </button>

                        </div>

                    </div>
                </div>
            </header>

            {/* Mobile Sidebar Overlay */}
            <div
                className={clsx(
                    "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300 md:hidden",
                    sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                onClick={closeAll}
            />

            {/* Mobile Sidebar (Slide Glass Drawer) */}
            <aside
                className={clsx(
                    "fixed top-0 right-0 bottom-0 z-50 w-80 max-w-[85vw] bg-background/95 border-l border-primary/20 backdrop-blur-2xl shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-in-out md:hidden",
                    sidebarOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
                {/* Top Section */}
                <div>
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-border/60">
                        <div className="flex items-center gap-2">
                            <LogoIcon className="w-7 h-7 text-primary" />
                            <span className="text-sm font-black text-foreground uppercase tracking-wider">Navigation</span>
                        </div>
                        <button
                            onClick={closeAll}
                            className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* User Info Mobile Card */}
                    {context?.user?.name && (
                        <div className="p-4 mx-4 mt-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center gap-3">
                            <div className="text-sm font-black bg-primary text-primary-foreground w-11 h-11 flex justify-center items-center rounded-xl shrink-0 shadow-sm">
                                {context?.user?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-extrabold truncate text-foreground">{context?.user?.name}</span>
                                <span className="text-xs text-primary font-semibold capitalize flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-accent" />
                                    {context?.user?.role || 'User'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Sidebar Links */}
                    <nav className="p-4 space-y-2">
                        {navLinks.map((link) =>
                            link.show ? (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={closeAll}
                                    className={clsx(
                                        "flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all",
                                        isActive(link.href)
                                            ? "text-primary-foreground bg-primary shadow-lg shadow-primary/25 font-black"
                                            : "text-muted-foreground hover:text-foreground hover:bg-card border border-transparent hover:border-border/60"
                                    )}
                                >
                                    {link.icon}
                                    <span>{link.label}</span>
                                </Link>
                            ) : null
                        )}
                    </nav>
                </div>

                {/* Bottom Logout / Sign In Section */}
                <div className="p-5 border-t border-border/60 bg-card/40">
                    {context?.user?.name ? (
                        <button
                            onClick={logout}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-destructive bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 rounded-2xl transition-all"
                        >
                            <LogOut className="w-4 h-4" />
                            <span>Sign Out Account</span>
                        </button>
                    ) : (
                        <Link
                            href={'/sign-in'}
                            onClick={closeAll}
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

export default Navbar