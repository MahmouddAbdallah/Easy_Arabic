'use client'

import { useEffect, useState, useSyncExternalStore, type MouseEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import axios from "axios"
import { toast } from "react-hot-toast"
import { LogIn, Menu } from "lucide-react"

import { useAppContext } from "@/components/AppContext"
import { displayFont } from "@/lib/fonts"
import { cn } from "@/lib/utils"

import { Brand } from "./Brand"
import { MobileDrawer } from "./MobileDrawer"
import { NavLinks } from "./NavLinks"
import ThemeToggle from "./ThemeToggle"
import { UserProfileMenu } from "./UserProfileMenu"
import { focusRing, iconButtonClass } from "./styles"

/** Tailwind's `md` breakpoint, where the inline links replace the drawer. */
const DESKTOP_QUERY = "(min-width: 768px)"
const SCROLL_THRESHOLD = 8

/* Page scroll as an external store: components re-render only when "scrolled" flips, not on every scroll event. */
const subscribeToScroll = (onChange: () => void) => {
    window.addEventListener("scroll", onChange, { passive: true })
    return () => window.removeEventListener("scroll", onChange)
}
const getScrolled = () => window.scrollY > SCROLL_THRESHOLD
const getServerScrolled = () => false

/** Moves keyboard focus past the header. The root <main> has no id to link to, so focus it directly. */
const skipToContent = (event: MouseEvent<HTMLAnchorElement>) => {
    const main = document.querySelector("main")
    if (!main) return
    event.preventDefault()
    main.setAttribute("tabindex", "-1")
    main.style.outline = "none"
    main.focus()
    main.addEventListener(
        "blur",
        () => {
            main.removeAttribute("tabindex")
            main.style.outline = ""
        },
        { once: true }
    )
}

const Navbar = () => {
    const router = useRouter()
    const context = useAppContext()
    const user = context?.user

    const [drawerOpen, setDrawerOpen] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)
    const scrolled = useSyncExternalStore(subscribeToScroll, getScrolled, getServerScrolled)

    // Don't leave the modal drawer open over the desktop layout after the window is widened.
    useEffect(() => {
        const media = window.matchMedia(DESKTOP_QUERY)
        const onChange = (event: MediaQueryListEvent) => {
            if (event.matches) setDrawerOpen(false)
        }
        media.addEventListener("change", onChange)
        return () => media.removeEventListener("change", onChange)
    }, [])

    const logout = async () => {
        if (loggingOut) return
        setLoggingOut(true)
        try {
            const { data } = await axios.post('/api/auth/logout')
            toast.success(data?.message || 'Logged out successfully')
            context?.setUser(null)
            setDrawerOpen(false)
            router.push('/sign-in')
        } catch (error) {
            const data = axios.isAxiosError(error) ? error.response?.data : undefined
            toast.error(data?.error?.message || data?.message || 'Could not sign out. Please try again.')
        } finally {
            setLoggingOut(false)
        }
    }

    return (
        <>
            <a
                href="#main"
                onClick={skipToContent}
                // Parked above the viewport until focused. (`sr-only` + `focus:not-sr-only` would reset the padding.)
                className="fixed start-4 top-3 z-[60] -translate-y-[calc(100%+1.5rem)] rounded-lg bg-card px-4 py-2 text-sm font-medium text-foreground shadow-lg ring-2 ring-brand transition-transform duration-150 focus:translate-y-0 motion-reduce:transition-none"
            >
                Skip to content
            </a>

            <header
                className={cn(
                    // `font-display` (the wordmark) resolves through this variable.
                    displayFont.variable,
                    "sticky top-0 z-50 w-full border-b backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none",
                    scrolled
                        ? "border-border bg-background/90 shadow-[0_10px_30px_-18px_rgb(0_0_0/0.3)]"
                        : "border-border/60 bg-background/70"
                )}
            >
                {/* Gutters follow the page below: public pages use px-4/md:px-6, signed-in pages px-4/sm:px-6/lg:px-8. */}
                <div
                    className={cn(
                        "mx-auto flex h-16 w-full max-w-7xl items-center",
                        user ? "px-4 sm:px-6 lg:px-8" : "px-4 md:px-6"
                    )}
                >
                    <Brand />

                    <nav aria-label="Main" className="ms-4 hidden md:block lg:ms-10">
                        <NavLinks user={user} variant="desktop" />
                    </nav>

                    <div className="ms-auto flex items-center gap-1.5">
                        <div className="hidden md:block">
                            <ThemeToggle />
                        </div>
                        <span aria-hidden className="mx-1.5 hidden h-6 w-px bg-border md:block" />

                        {user?.name ? (
                            // Below `md` the account details live in the drawer instead.
                            <div className="hidden md:block">
                                <UserProfileMenu user={user} onLogout={logout} loggingOut={loggingOut} />
                            </div>
                        ) : (
                            <Link
                                href="/sign-in"
                                className={cn(
                                    "inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-foreground shadow-xs transition-[background-color,transform] hover:bg-brand/90 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 sm:px-4",
                                    focusRing,
                                    "focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                )}
                            >
                                <LogIn aria-hidden className="hidden size-4 sm:block" />
                                Sign in
                            </Link>
                        )}

                        <button
                            type="button"
                            onClick={() => setDrawerOpen(true)}
                            aria-label="Open navigation menu"
                            aria-haspopup="dialog"
                            aria-expanded={drawerOpen}
                            className={cn(iconButtonClass, "md:hidden")}
                        >
                            <Menu aria-hidden className="size-5" />
                        </button>
                    </div>
                </div>
            </header>

            <MobileDrawer
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                user={user}
                onLogout={logout}
                loggingOut={loggingOut}
            />
        </>
    )
}

export default Navbar
