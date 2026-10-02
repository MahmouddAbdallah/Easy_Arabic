import { BookOpen } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import BackgroundImage from "@/components/auth/BackgroundImage"

/**
 * The exact card layout used by the Sign in / Sign up pages, extracted so the
 * password-reset, verification and change-password pages look identical.
 * (Sign in / Sign up keep their own copy of this markup, untouched.)
 */
export default function AuthShell({
    title,
    description,
    children,
    footer,
}: {
    title: string
    description?: string
    children: ReactNode
    footer?: ReactNode
}) {
    return (
        <div className="relative h-svh flex items-center justify-center p-4 sm:p-6 md:p-10 overflow-hidden bg-background">
            <BackgroundImage />
            <div className="absolute size-150 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />
            <div className="relative w-full max-w-4xl bg-card/95 backdrop-blur-sm border border-border/80 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
                <div className="h-150 relative hidden md:flex flex-col justify-between p-8 bg-muted/40 border-r border-border/50 overflow-hidden">
                    <Image
                        src="/sign-up.jpg"
                        alt="Quran Sign In Illustration"
                        fill
                        priority
                        className="object-cover opacity-90 transition-transform duration-500 hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-black/20" />
                    <div className="relative z-10 flex items-center gap-2 text-white">
                        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
                            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                                <BookOpen className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-bold text-lg tracking-wide">Quran App</span>
                        </Link>
                    </div>
                    <div className="relative z-10 text-white space-y-2">
                        <blockquote className="text-lg font-medium leading-snug">
                            Recite in the name of your Lord who created.
                        </blockquote>
                        <p className="text-xs text-white/70">Surah Al-Alaq (96:1)</p>
                    </div>
                </div>
                <div className="p-6 sm:p-10 flex flex-col justify-center space-y-6">
                    <div className="space-y-1 text-left">
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
                        {description && <p className="text-sm text-muted-foreground">{description}</p>}
                    </div>
                    {children}
                    {footer && <p className="text-center text-xs text-muted-foreground pt-2">{footer}</p>}
                </div>
            </div>
        </div>
    )
}
