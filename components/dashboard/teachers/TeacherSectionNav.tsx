'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Settings, Users, type LucideIcon } from 'lucide-react'
import { cn } from 'cn'

interface TeacherSectionNavProps {
    teacherId: string
    totalLessons: number
    totalFamilies: number
}

/**
 * Route-based segmented nav. Each section is a real <Link>, so prefetching,
 * middle-click and browser back/forward all work and the active state always
 * mirrors the URL (the old uncontrolled Tabs drifted out of sync on back).
 */
const TeacherSectionNav = ({ teacherId, totalLessons, totalFamilies }: TeacherSectionNavProps) => {
    const pathname = usePathname()
    const basePath = `/dashboard/teachers/${teacherId}`
    const onFamilies = pathname.startsWith(`${basePath}/families`)
    const onSettings = pathname.startsWith(`${basePath}/settings`)

    const items: Array<{ href: string; label: string; count?: number; icon: LucideIcon; active: boolean }> = [
        { href: basePath, label: 'Lessons', count: totalLessons, icon: BookOpen, active: !onFamilies && !onSettings },
        { href: `${basePath}/families`, label: 'families', count: totalFamilies, icon: Users, active: onFamilies },
        { href: `${basePath}/settings`, label: 'Settings', icon: Settings, active: onSettings },
    ]

    return (
        <nav
            aria-label="Teacher sections"
            className="w-full rounded-xl border border-border/60 bg-card p-1 shadow-xs sm:w-fit"
        >
            <ul className="flex gap-1">
                {items.map(({ href, label, count, icon: Icon, active }) => (
                    <li key={href} className="flex-1 sm:flex-none">
                        <Link
                            href={href}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                                'flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                                active
                                    ? 'bg-brand-soft text-brand ring-1 ring-brand/20'
                                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                            {count !== undefined && (
                                <span
                                    className={cn(
                                        'rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                                        active ? 'bg-brand/15 text-brand' : 'bg-muted text-muted-foreground'
                                    )}
                                >
                                    {count}
                                </span>
                            )}
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    )
}

export default TeacherSectionNav