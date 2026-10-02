'use client'

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import axios from "axios"
import { toast } from "react-hot-toast"
import { Menu, LogIn } from "lucide-react"

import { LogoIcon } from "../icons"
import ThemeToggle from "./ThemeToggle"
import { useAppContext } from "@/components/AppContext"

import { NavLinks } from "./NavLinks"
import { UserProfileMenu } from "./UserProfileMenu"
import { MobileDrawer } from "./MobileDrawer"

const Navbar = () => {
    const router = useRouter()
    const context = useAppContext()

    const [sidebarOpen, setSidebarOpen] = useState(false)

    useEffect(() => {
        document.body.style.overflow = sidebarOpen ? 'hidden' : 'unset'
    }, [sidebarOpen])

    const logout = async () => {
        try {
            const { data } = await axios.post('/api/auth/logout')
            toast.success(data?.message || 'Logged out successfully')
            context?.setUser(null)
            setSidebarOpen(false)
            router.push('/sign-in')
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an error')
        }
    }

    return (
        <>
            <header className="sticky top-0 z-50 w-full bg-background/70 backdrop-blur-xl border-b border-border/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-all">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-transparent via-primary/50 to-transparent" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16 sm:h-20">

                        {/* Logo */}
                        <Link href="/" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 group focus:outline-none">
                            <div className="relative p-2 rounded-2xl bg-primary/10 border border-primary/20 text-primary transition-all duration-300 group-hover:scale-105 group-hover:bg-primary/20 group-hover:shadow-[0_0_20px_rgba(var(--primary),0.3)]">
                                <LogoIcon className="w-7 h-7 sm:w-8 sm:h-8 fill-primary stroke-primary dark:fill-blue-500 dark:stroke-blue-500 transition-transform" />
                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                                </span>
                            </div>
                        </Link>

                        {/* Right Side Actions */}
                        <div className="flex items-center gap-3 sm:gap-5">

                            {/* Desktop Nav Links */}
                            <nav className="hidden md:flex items-center gap-1.5 p-1.5 rounded-2xl bg-card/60 border border-border/60 backdrop-blur-md">
                                <NavLinks user={context?.user} variant="desktop" />
                            </nav>

                            {/* Theme Toggle */}
                            <div className="p-1 rounded-xl bg-card/60 border border-border/60 backdrop-blur-md">
                                <ThemeToggle />
                            </div>

                            {/* User Menu / Sign In */}
                            {context?.user?.name ? (
                                <UserProfileMenu user={context.user} onLogout={logout} />
                            ) : (
                                <Link
                                    href="/sign-in"
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-extrabold bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl transition-all shadow-md shadow-primary/20 scale-100 hover:scale-[1.02]"
                                >
                                    <LogIn className="w-4 h-4" />
                                    <span>Sign In</span>
                                </Link>
                            )}

                            {/* Mobile Hamburger Menu Toggle */}
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

            {/* Mobile Drawer */}
            <MobileDrawer
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                user={context?.user}
                onLogout={logout}
            />
        </>
    )
}

export default Navbar