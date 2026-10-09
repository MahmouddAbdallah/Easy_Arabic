'use client'

import { useMemo } from 'react'
import { format, isSameDay } from 'date-fns'
import { Hourglass } from 'lucide-react'
import { cn } from 'cn'
import { hasNoTimeOfDay, layoutOverlapping, minutesIntoLocalDay, parseInstant } from '@/lib/planner/time'
import type { PlannerLesson } from '@/types/plannerTypes'
import { fmtDuration, fmtTime, fmtTimeRange } from './format'
import { lessonTone } from './status'

const HOUR_PX = 56
const GUTTER = 'w-14 shrink-0'
const DEFAULT_FIRST_HOUR = 8
const DEFAULT_LAST_HOUR = 22

export type Counterpart = 'teacher' | 'family'

interface WeekGridProps {
    days: Date[]
    lessons: PlannerLesson[]
    /** Which side of the lesson to name on each block: a teacher sees families, a family sees teachers. */
    counterpart: Counterpart
    now: number
    selectedId?: string | null
    onSelect: (lesson: PlannerLesson) => void
}

type Placed = { lesson: PlannerLesson; start: number; end: number }

const label = (lesson: PlannerLesson, counterpart: Counterpart) => lesson[counterpart].name

/** Accessible name for a block: who, when, and what state. */
const ariaFor = (lesson: PlannerLesson, counterpart: Counterpart, now: number) =>
    `${lesson.student} with ${label(lesson, counterpart)}, ${format(parseInstant(lesson.startsAt)!, 'EEEE MMMM d')}, ${fmtTimeRange(lesson.startsAt, lesson.endsAt)}, ${lessonTone(lesson, now).label}${lesson.pendingRequest ? ', change request pending' : ''}`

/**
 * Seven day columns on an hour grid. A lesson is a block whose top and height come from its start and `duration`
 * (so the end time on screen is exactly start + duration). Overlapping blocks (e.g. a teacher's lessons with two
 * families that were logged for the same hour) sit side by side instead of hiding each other.
 *
 * Lessons logged with the older form have a date but no time of day. They can't be placed on an hour, so they sit in a
 * "No time set" lane above the grid instead of pretending to start at midnight.
 */
const WeekGrid = ({ days, lessons, counterpart, now, selectedId, onSelect }: WeekGridProps) => {
    const { byDay, noTime, firstHour, lastHour } = useMemo(() => {
        const timed = new Map<number, Placed[]>()
        const noTime = new Map<number, PlannerLesson[]>()
        let minMinute = DEFAULT_FIRST_HOUR * 60
        let maxMinute = DEFAULT_LAST_HOUR * 60

        days.forEach((_, i) => {
            timed.set(i, [])
            noTime.set(i, [])
        })

        for (const lesson of lessons) {
            const start = parseInstant(lesson.startsAt)
            if (!start) continue
            const dayIndex = days.findIndex((day) => isSameDay(day, start))
            if (dayIndex === -1) continue

            if (hasNoTimeOfDay(start)) {
                noTime.get(dayIndex)!.push(lesson)
                continue
            }
            const startMin = minutesIntoLocalDay(start)
            const endMin = Math.min(24 * 60, startMin + lesson.duration) // a lesson never spills past midnight on screen
            minMinute = Math.min(minMinute, startMin)
            maxMinute = Math.max(maxMinute, endMin)
            timed.get(dayIndex)!.push({ lesson, start: startMin, end: endMin })
        }

        const firstHour = Math.max(0, Math.floor(minMinute / 60))
        const lastHour = Math.min(24, Math.max(firstHour + 1, Math.ceil(maxMinute / 60)))
        const byDay = new Map([...timed].map(([i, placed]) => [i, layoutOverlapping(placed)]))
        return { byDay, noTime, firstHour, lastHour }
    }, [days, lessons])

    const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i)
    const gridHeight = hours.length * HOUR_PX
    const nowDate = new Date(now)
    const todayIndex = days.findIndex((day) => isSameDay(day, nowDate))
    const nowMinute = minutesIntoLocalDay(nowDate)
    const showNowLine = todayIndex !== -1 && nowMinute >= firstHour * 60 && nowMinute <= lastHour * 60
    const hasNoTimeLessons = [...noTime.values()].some((list) => list.length > 0)

    return (
        <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-xs">
            <div className="min-w-[760px]">
                {/* Day headers */}
                <div className="flex border-b border-border/60 bg-muted/30">
                    <div className={GUTTER} aria-hidden />
                    {days.map((day, i) => {
                        const today = i === todayIndex
                        return (
                            <div key={day.toISOString()} className="flex-1 border-s border-border/50 px-2 py-2.5 text-center">
                                <p className={cn('text-[11px] font-semibold uppercase tracking-wide', today ? 'text-brand' : 'text-muted-foreground')}>
                                    {format(day, 'EEE')}
                                </p>
                                <p
                                    className={cn(
                                        'mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                                        today ? 'bg-brand text-white' : 'text-foreground'
                                    )}
                                    aria-label={format(day, 'EEEE, MMMM d') + (today ? ' (today)' : '')}
                                >
                                    {format(day, 'd')}
                                </p>
                            </div>
                        )
                    })}
                </div>

                {/* Lessons with no time of day */}
                {hasNoTimeLessons && (
                    <div className="flex border-b border-border/60 bg-muted/10">
                        <div className={cn(GUTTER, 'px-1.5 py-2 text-right text-[10px] font-medium leading-tight text-muted-foreground')}>No time set</div>
                        {days.map((day, i) => (
                            <div key={day.toISOString()} className="flex flex-1 flex-col gap-1 border-s border-border/50 p-1">
                                {noTime.get(i)!.map((lesson) => {
                                    const tone = lessonTone(lesson, now)
                                    return (
                                        <button
                                            key={lesson.id}
                                            type="button"
                                            onClick={() => onSelect(lesson)}
                                            aria-label={ariaFor(lesson, counterpart, now)}
                                            className={cn(
                                                'truncate rounded-md border px-1.5 py-1 text-start text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
                                                tone.block,
                                                selectedId === lesson.id && 'ring-2 ring-brand/60'
                                            )}
                                        >
                                            {lesson.student}
                                        </button>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                )}

                {/* Hour grid */}
                <div className="flex">
                    <div className={cn(GUTTER, 'relative')} style={{ height: gridHeight }} aria-hidden>
                        {hours.map((hour, i) => (
                            <span
                                key={hour}
                                className="absolute end-1.5 -translate-y-1/2 text-[10px] font-medium tabular-nums text-muted-foreground"
                                style={{ top: i * HOUR_PX, display: i === 0 ? 'none' : undefined }}
                            >
                                {format(new Date(2000, 0, 1, hour), 'h a')}
                            </span>
                        ))}
                    </div>

                    {days.map((day, i) => (
                        <div key={day.toISOString()} className="relative flex-1 border-s border-border/50" style={{ height: gridHeight }}>
                            {hours.map((hour, row) => (
                                <div key={hour} className={cn('absolute inset-x-0 border-t', row === 0 ? 'border-transparent' : 'border-border/40')} style={{ top: row * HOUR_PX, height: HOUR_PX }} />
                            ))}

                            {byDay.get(i)!.map(({ lesson, start, end, col, cols }) => {
                                const tone = lessonTone(lesson, now)
                                const top = ((start - firstHour * 60) / 60) * HOUR_PX
                                const height = Math.max(((end - start) / 60) * HOUR_PX, 22)
                                const compact = height < 44
                                return (
                                    <button
                                        key={lesson.id}
                                        type="button"
                                        onClick={() => onSelect(lesson)}
                                        aria-label={ariaFor(lesson, counterpart, now)}
                                        title={`${lesson.student} · ${fmtTimeRange(lesson.startsAt, lesson.endsAt)} · ${fmtDuration(lesson.duration)}`}
                                        className={cn(
                                            'absolute overflow-hidden rounded-md border px-1.5 text-start text-[11px] leading-tight transition-colors focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
                                            compact ? 'py-0.5' : 'py-1',
                                            tone.block,
                                            tone.muted && tone.key !== 'cancelled' && 'opacity-90',
                                            lesson.pendingRequest && 'ring-2 ring-gold/70',
                                            selectedId === lesson.id && 'z-10 ring-2 ring-brand'
                                        )}
                                        style={{
                                            top,
                                            height: height - 2,
                                            insetInlineStart: `calc(${(col / cols) * 100}% + 2px)`,
                                            width: `calc(${100 / cols}% - 4px)`,
                                        }}
                                    >
                                        <span className="flex items-start justify-between gap-1">
                                            <span className="min-w-0 truncate font-semibold">
                                                {compact ? `${fmtTime(lesson.startsAt)} · ${lesson.student}` : lesson.student}
                                            </span>
                                            {lesson.pendingRequest && <Hourglass className="mt-0.5 size-3 shrink-0" aria-hidden />}
                                        </span>
                                        {!compact && (
                                            <>
                                                <span className="block truncate opacity-90">{fmtTimeRange(lesson.startsAt, lesson.endsAt)}</span>
                                                {height >= 70 && <span className="block truncate opacity-80">{label(lesson, counterpart)}</span>}
                                            </>
                                        )}
                                    </button>
                                )
                            })}

                            {showNowLine && i === todayIndex && (
                                <div
                                    className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                                    style={{ top: ((nowMinute - firstHour * 60) / 60) * HOUR_PX }}
                                    aria-hidden
                                >
                                    <span className="-ms-1 size-2 rounded-full bg-rose-500" />
                                    <span className="h-px flex-1 bg-rose-500" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default WeekGrid
