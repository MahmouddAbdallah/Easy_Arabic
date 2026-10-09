'use client'

import { format, isSameDay } from 'date-fns'
import { CalendarX2, Hourglass, User } from 'lucide-react'
import { cn } from 'cn'
import { hasNoTimeOfDay, parseInstant } from '@/lib/planner/time'
import type { PlannerLesson } from '@/types/plannerTypes'
import { fmtDuration, fmtTimeRange } from './format'
import type { Counterpart } from './WeekGrid'
import { LessonStatusBadge, lessonTone } from './status'

interface AgendaListProps {
    days: Date[]
    lessons: PlannerLesson[]
    counterpart: Counterpart
    now: number
    selectedId?: string | null
    onSelect: (lesson: PlannerLesson) => void
}

/**
 * The same week as WeekGrid, as a list grouped by day. This is what phones get: an hour grid seven columns wide
 * is unreadable at 375px, a list of tappable cards is not.
 */
const AgendaList = ({ days, lessons, counterpart, now, selectedId, onSelect }: AgendaListProps) => {
    const groups = days.map((day) => ({
        day,
        items: lessons
            .filter((l) => {
                const start = parseInstant(l.startsAt)
                return start && isSameDay(day, start)
            })
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    }))

    if (groups.every((g) => g.items.length === 0)) {
        return (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 bg-card px-6 py-12 text-center">
                <div className="rounded-full bg-muted p-3 text-muted-foreground">
                    <CalendarX2 className="size-5" aria-hidden />
                </div>
                <p className="text-sm font-semibold text-foreground">No lessons this week</p>
                <p className="max-w-xs text-xs text-muted-foreground">Use the arrows above to look at another week.</p>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            {groups
                .filter((g) => g.items.length > 0)
                .map(({ day, items }) => {
                    const today = isSameDay(day, new Date(now))
                    return (
                        <section key={day.toISOString()} aria-label={format(day, 'EEEE, MMMM d')}>
                            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <span className={cn(today && 'text-brand')}>{format(day, 'EEEE, MMM d')}</span>
                                {today && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold normal-case text-white">Today</span>}
                            </h3>
                            <ul className="space-y-2">
                                {items.map((lesson) => {
                                    const tone = lessonTone(lesson, now)
                                    const start = parseInstant(lesson.startsAt)!
                                    return (
                                        <li key={lesson.id}>
                                            <button
                                                type="button"
                                                onClick={() => onSelect(lesson)}
                                                className={cn(
                                                    'flex w-full items-start gap-3 rounded-xl border bg-card p-3 text-start shadow-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
                                                    selectedId === lesson.id ? 'border-brand ring-1 ring-brand/40' : 'border-border/60',
                                                    lesson.pendingRequest && 'border-gold/60'
                                                )}
                                            >
                                                <span className={cn('mt-0.5 w-1 self-stretch rounded-full', tone.block.split(' ').find((c) => c.startsWith('bg-')) ?? 'bg-muted')} aria-hidden />
                                                <span className="min-w-0 flex-1 space-y-1">
                                                    <span className="flex items-center justify-between gap-2">
                                                        <span className={cn('text-sm font-semibold text-foreground', lesson.status === 'CANCELLED' && 'line-through opacity-70')}>
                                                            {hasNoTimeOfDay(start) ? 'No time set' : fmtTimeRange(lesson.startsAt, lesson.endsAt)}
                                                        </span>
                                                        <LessonStatusBadge lesson={lesson} now={now} />
                                                    </span>
                                                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                        <User className="size-3.5 shrink-0" aria-hidden />
                                                        <span className="truncate">
                                                            {lesson.student} · {lesson[counterpart].name}
                                                        </span>
                                                    </span>
                                                    <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                                        <span>{fmtDuration(lesson.duration)}</span>
                                                        {lesson.pendingRequest && (
                                                            <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
                                                                <Hourglass className="size-3" aria-hidden />
                                                                {lesson.pendingRequest.type === 'CANCEL' ? 'Cancellation requested' : 'Reschedule requested'}
                                                            </span>
                                                        )}
                                                    </span>
                                                </span>
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        </section>
                    )
                })}
        </div>
    )
}

export default AgendaList
