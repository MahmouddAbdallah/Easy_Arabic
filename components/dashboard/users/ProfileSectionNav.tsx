'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, CalendarDays, GraduationCap, SettingsIcon, Users } from 'lucide-react'
import { cn } from 'cn'

type ProfileKind = 'teacher' | 'family'

interface ProfileSectionNavProps {
    kind: ProfileKind
    /** Id of the teacher or family whose page this is. */
    id: string
    totalLessons: number
    /** Families (on a teacher's page) or teachers (on a family's page). */
    totalLinked: number
    /** Lesson-change requests waiting for an answer (shown on the Planner tab). */
    pendingRequests?: number
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
const ProfileSectionNav = ({ kind, id, totalLessons, totalLinked, pendingRequests = 0 }: ProfileSectionNavProps) => {
    const pathname = usePathname()
    const { base, segment, label, icon, ariaLabel } = KINDS[kind]
    const basePath = `${base}/${id}`
    const onLinked = pathname.startsWith(`${basePath}/${segment}`)
    const onPlanner = pathname.startsWith(`${basePath}/planner`)
    const onSettings = pathname.startsWith(`${basePath}/settings`)

    const items = [
        { href: basePath, label: 'Lessons', count: totalLessons, icon: BookOpen, active: !onLinked && !onPlanner, hint: undefined },
        { href: `${basePath}/${segment}`, label, count: totalLinked, icon, active: onLinked, hint: undefined },
        { href: `${basePath}/settings`, label: 'Settings', icon: SettingsIcon, active: onSettings },
        { href: `${basePath}/planner`, label: 'Planner', count: pendingRequests, icon: CalendarDays, active: onPlanner, hint: `${pendingRequests} pending ${pendingRequests === 1 ? 'request' : 'requests'}` },
    ]

    return (
        <nav aria-label={ariaLabel} className="w-full rounded-xl border border-border/60 bg-card p-1 shadow-xs sm:w-fit">
            <ul className="flex gap-1 w-full  max-md:overflow-x-auto">
                {items.map(({ href, label, count, icon: Icon, active, hint }) => (
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
                                    title={hint}
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
