'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, GraduationCap, Settings, Users, type LucideIcon } from 'lucide-react'
import { cn } from 'cn'

type ProfileKind = 'teacher' | 'family'

interface ProfileSectionNavProps {
    kind: ProfileKind
    /** Id of the teacher or family whose page this is. */
    id: string
    totalLessons: number
    /** Families (on a teacher's page) or teachers (on a family's page). */
    totalLinked: number
}

// What differs between the two detail pages; the nav itself is identical.
const KINDS = {
    teacher: { base: '/dashboard/teachers', segment: 'families', label: 'Families', icon: Users, ariaLabel: 'Teacher sections' },
    family: { base: '/dashboard/families', segment: 'teachers', label: 'Teachers', icon: GraduationCap, ariaLabel: 'Family sections' },
} as const

/**
 * Route-based segmented nav. Each section is a real <Link>, so prefetching,
 * middle-click and browser back/forward all work and the active state always
 * mirrors the URL.
 */
const ProfileSectionNav = ({ kind, id, totalLessons, totalLinked }: ProfileSectionNavProps) => {
    const pathname = usePathname()
    const { base, segment, label, icon, ariaLabel } = KINDS[kind]
    const basePath = `${base}/${id}`
    const onLinked = pathname.startsWith(`${basePath}/${segment}`)
    const onSettings = pathname.startsWith(`${basePath}/settings`)

    const items: Array<{ href: string; label: string; count?: number; icon: LucideIcon; active: boolean }> = [
        { href: basePath, label: 'Lessons', count: totalLessons, icon: BookOpen, active: !onLinked && !onSettings },
        { href: `${basePath}/${segment}`, label, count: totalLinked, icon, active: onLinked },
        { href: `${basePath}/settings`, label: 'Settings', icon: Settings, active: onSettings },
    ]

    return (
        <nav aria-label={ariaLabel} className="w-full rounded-xl border border-border/60 bg-card p-1 shadow-xs sm:w-fit">
            <ul className="flex gap-1">
                {items.map(({ href, label, count, icon: Icon, active }) => (
                    <li key={href} className="flex-1 sm:flex-none">
                        <Link
                            href={href}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                                'flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none',
                                active
                                    ? 'bg-brand-soft text-brand ring-1 ring-brand/20'
                                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                            )}
                        >
                            <Icon className="size-4" />
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

export default ProfileSectionNav
