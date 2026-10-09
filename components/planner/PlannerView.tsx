'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { format, isSameDay } from 'date-fns'
import { CalendarCheck, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Hourglass, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import StatTile from '@/components/dashboard/users/StatTile'
import { cn } from 'cn'
import { PlannerApiError, plannerApi, type PlannerSubject } from '@/lib/planner/client'
import { addLocalDays, MS_DAY, parseInstant, startOfLocalWeek, weekDays } from '@/lib/planner/time'
import type { LessonChangeType, PlannerLesson, PlannerRole } from '@/types/plannerTypes'
import AgendaList from './AgendaList'
import ConfirmDialog from './ConfirmDialog'
import LessonDetailsSheet from './LessonDetailsSheet'
import RequestChangeDialog from './RequestChangeDialog'
import RequestsPanel from './RequestsPanel'
import ScheduleLessonDialog from './ScheduleLessonDialog'
import TeacherRescheduleDialog from './TeacherRescheduleDialog'
import WeekGrid, { type Counterpart } from './WeekGrid'
import { fmtDateTime } from './format'
import { isUpcomingScheduled } from './status'

interface PlannerViewProps {
    /** Who is looking. The server enforces what each role may do; this only decides what the screen offers. */
    role: PlannerRole
    /** Admin only: whose planner to show (the dashboard pages). */
    subject?: PlannerSubject
}

type Tab = 'calendar' | 'requests'

/** The widest window the API serves is 42 days; 41 leaves room for a daylight-saving hour. */
const WINDOW_DAYS = 41

type Loaded = { from: Date; to: Date; key: number; lessons: PlannerLesson[] }

const LEGEND = [
    { label: 'Upcoming', swatch: 'border-brand/40 bg-brand-soft' },
    { label: 'Attended', swatch: 'border-teal-500/40 bg-teal-500/15' },
    { label: 'Absent', swatch: 'border-orange-500/40 bg-orange-500/15' },
    { label: 'Cancelled', swatch: 'border-rose-500/40 bg-rose-500/10' },
    { label: 'Needs update', swatch: 'border-dashed border-amber-500/60 bg-amber-500/10' },
    { label: 'Request pending', swatch: 'border-gold/70 bg-card ring-2 ring-gold/70' },
]

/**
 * The planner for ONE person: a teacher's lessons with their families, a family's lessons with its teachers, or (for an
 * admin on the dashboard) whichever of those they opened. Everything is read through /api/planner, so what is on
 * screen is exactly what the server decided this person may see.
 */
const PlannerView = ({ role, subject }: PlannerViewProps) => {
    // Time-dependent state starts empty and is filled in after mount: the server's clock/zone must never decide
    // what "today" or "10:00" looks like in the browser.
    const [now, setNow] = useState<number | null>(null)
    const [weekStart, setWeekStart] = useState<Date | null>(null)
    useEffect(() => {
        setNow(Date.now())
        setWeekStart(startOfLocalWeek(new Date()))
        const timer = setInterval(() => setNow(Date.now()), 60_000)
        return () => clearInterval(timer)
    }, [])

    const [tab, setTab] = useState<Tab>('calendar')
    const [requestFilter, setRequestFilter] = useState<'PENDING' | 'ALL'>('PENDING')
    const [refreshKey, setRefreshKey] = useState(0)
    const bump = useCallback(() => setRefreshKey((k) => k + 1), [])

    const subjectKey = subject ? JSON.stringify(subject) : ''
    const [loaded, setLoaded] = useState<Loaded | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [pendingCount, setPendingCount] = useState<number | null>(null)

    // ── Lessons: one request covers ~6 weeks, so paging between weeks is instant. ──
    const inFlight = useRef(0)
    useEffect(() => {
        if (!weekStart) return
        const weekEnd = addLocalDays(weekStart, 7)
        const covered = loaded && loaded.key === refreshKey && weekStart >= loaded.from && weekEnd <= loaded.to
        if (covered) return

        const from = addLocalDays(weekStart, -7)
        const to = new Date(from.getTime() + WINDOW_DAYS * MS_DAY)
        const ticket = ++inFlight.current
        const controller = new AbortController()
        setLoading(true)
        setError(null)
        plannerApi
            .lessons(from, to, subject, controller.signal)
            .then((res) => ticket === inFlight.current && setLoaded({ from, to, key: refreshKey, lessons: res.lessons }))
            .catch((e) => {
                if (controller.signal.aborted || ticket !== inFlight.current) return
                setError((e as PlannerApiError).message)
            })
            .finally(() => ticket === inFlight.current && setLoading(false))
        return () => controller.abort()
        // `loaded` is deliberately not a dependency: it is the result of this effect.
    }, [weekStart, refreshKey, subjectKey])

    // ── Pending-request counter (tab badge + tile). A failure here just hides the number. ──
    useEffect(() => {
        const controller = new AbortController()
        plannerApi
            .requests({ page: 1, pageSize: 1 }, subject, controller.signal)
            .then((res) => setPendingCount(res.totals.PENDING))
            .catch(() => undefined)
        return () => controller.abort()
    }, [refreshKey, subjectKey])

    // ── Derived ──
    const counterpart: Counterpart = role === 'teacher' ? 'family' : role === 'family' ? 'teacher' : subject && 'teacherId' in subject ? 'family' : 'teacher'
    const days = useMemo(() => (weekStart ? weekDays(weekStart) : []), [weekStart])
    const allLessons = loaded?.lessons ?? []
    const weekLessons = useMemo(() => {
        if (!weekStart) return []
        const end = addLocalDays(weekStart, 7).getTime()
        return allLessons.filter((l) => {
            const t = parseInstant(l.startsAt)?.getTime() ?? NaN
            return t >= weekStart.getTime() && t < end
        })
    }, [allLessons, weekStart])

    const next = useMemo(() => {
        if (now === null) return null
        return allLessons.filter((l) => isUpcomingScheduled(l, now)).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null
    }, [allLessons, now])
    const activeThisWeek = weekLessons.filter((l) => l.status !== 'CANCELLED').length
    const lessonDays = useMemo(() => allLessons.filter((l) => l.status !== 'CANCELLED').map((l) => parseInstant(l.startsAt)).filter((d): d is Date => !!d), [allLessons])

    // ── Selection and dialogs ──
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const selected = allLessons.find((l) => l.id === selectedId) ?? null
    const [scheduleOpen, setScheduleOpen] = useState(false)
    const [requestDialog, setRequestDialog] = useState<{ lesson: PlannerLesson; type: LessonChangeType } | null>(null)
    const [moving, setMoving] = useState<PlannerLesson | null>(null)
    const [cancelling, setCancelling] = useState<PlannerLesson | null>(null)
    const [withdrawing, setWithdrawing] = useState<PlannerLesson | null>(null)
    const [busy, setBusy] = useState(false)

    const cancelLesson = async () => {
        if (!cancelling) return
        setBusy(true)
        try {
            const res = await plannerApi.changeLesson(cancelling.id, { action: 'cancel' })
            toast.success(res.message)
            setCancelling(null)
            setSelectedId(null)
        } catch (e) {
            toast.error((e as PlannerApiError).message)
            setCancelling(null)
        } finally {
            setBusy(false)
            bump()
        }
    }

    const withdraw = async () => {
        const requestId = withdrawing?.pendingRequest?.id
        if (!requestId) return
        setBusy(true)
        try {
            const res = await plannerApi.withdrawRequest(requestId)
            toast.success(res.message)
            setWithdrawing(null)
        } catch (e) {
            toast.error((e as PlannerApiError).message)
            setWithdrawing(null)
        } finally {
            setBusy(false)
            bump()
        }
    }

    const reviewRequest = () => {
        setSelectedId(null)
        setRequestFilter('PENDING')
        setTab('requests')
    }

    const goToWeek = (date: Date) => setWeekStart(startOfLocalWeek(date))
    const weekLabel = weekStart
        ? (() => {
            const end = addLocalDays(weekStart, 6)
            return weekStart.getMonth() === end.getMonth()
                ? `${format(weekStart, 'MMM d')} – ${format(end, 'd, yyyy')}`
                : weekStart.getFullYear() === end.getFullYear()
                    ? `${format(weekStart, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
                    : `${format(weekStart, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`
        })()
        : ''
    const onThisWeek = weekStart && now !== null ? isSameDay(weekStart, startOfLocalWeek(new Date(now))) : true

    const ready = now !== null && weekStart !== null

    return (
        <div className="space-y-6">
            {/* Top: tiles + primary action */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-3">
                    <StatTile
                        icon={CalendarCheck}
                        label="Next lesson"
                        value={ready ? (next ? format(parseInstant(next.startsAt)!, 'EEE, MMM d') : '—') : '…'}
                        hint={ready ? (next ? `${format(parseInstant(next.startsAt)!, 'h:mm a')} · ${next[counterpart].name}` : 'Nothing scheduled ahead') : undefined}
                        className="col-span-2 md:col-span-1"
                    />
                    <StatTile icon={CalendarDays} label="This week" value={ready ? String(activeThisWeek) : '…'} hint={activeThisWeek === 1 ? 'lesson' : 'lessons'} />
                    <StatTile
                        icon={Hourglass}
                        label="Pending requests"
                        value={pendingCount === null ? '…' : String(pendingCount)}
                        hint={role === 'family' ? 'Waiting for your teacher' : 'Waiting for an answer'}
                    />
                </div>
                {role === 'teacher' && (
                    <Button onClick={() => setScheduleOpen(true)} className="w-full sm:w-auto">
                        <CalendarPlus className="size-4" aria-hidden /> Schedule lessons
                    </Button>
                )}
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
                <TabsList className="h-9">
                    <TabsTrigger value="calendar" className="gap-1.5 px-4 text-sm">
                        <CalendarDays className="size-4" aria-hidden /> Calendar
                    </TabsTrigger>
                    <TabsTrigger value="requests" className="gap-1.5 px-4 text-sm">
                        <Inbox className="size-4" aria-hidden /> Requests
                        {pendingCount !== null && pendingCount > 0 && (
                            <span className="rounded-full bg-gold/30 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-800 dark:text-amber-200">{pendingCount}</span>
                        )}
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {tab === 'calendar' ? (
                <section aria-label="Weekly calendar" className="space-y-4">
                    {/* Week toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                            <Button variant="outline" size="icon" aria-label="Previous week" disabled={!ready} onClick={() => weekStart && setWeekStart(addLocalDays(weekStart, -7))}>
                                <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
                            </Button>
                            <Button variant="outline" size="icon" aria-label="Next week" disabled={!ready} onClick={() => weekStart && setWeekStart(addLocalDays(weekStart, 7))}>
                                <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
                            </Button>
                            <Button variant="outline" disabled={!ready || onThisWeek} onClick={() => goToWeek(new Date())}>
                                Today
                            </Button>
                        </div>

                        <Popover>
                            <PopoverTrigger
                                disabled={!ready}
                                className="flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50"
                                aria-label={`Showing ${weekLabel}. Choose another date`}
                            >
                                <CalendarDays className="size-4 text-brand" aria-hidden />
                                {ready ? weekLabel : <Skeleton className="h-4 w-32" />}
                            </PopoverTrigger>
                            <PopoverContent className="w-auto rounded-md border-border/80 p-0" align="end">
                                <Calendar
                                    mode="single"
                                    selected={weekStart ?? undefined}
                                    defaultMonth={weekStart ?? undefined}
                                    onSelect={(picked) => picked && goToWeek(picked)}
                                    modifiers={{ hasLesson: lessonDays }}
                                    modifiersClassNames={{ hasLesson: 'font-bold underline decoration-brand decoration-2 underline-offset-4' }}
                                    className="p-3"
                                />
                                <p className="border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">Underlined days have lessons.</p>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {error ? (
                        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                            <p>{error}</p>
                            <Button variant="outline" size="sm" onClick={() => { setLoaded(null); bump() }}>
                                Try again
                            </Button>
                        </div>
                    ) : !ready || (loading && !loaded) ? (
                        <Skeleton className="h-130 w-full rounded-xl" aria-label="Loading your calendar" />
                    ) : (
                        <div className={cn('transition-opacity', loading && 'opacity-70')} aria-busy={loading}>
                            <div className="hidden md:block">
                                <WeekGrid days={days} lessons={weekLessons} counterpart={counterpart} now={now!} selectedId={selectedId} onSelect={(l) => setSelectedId(l.id)} />
                            </div>
                            <div className="md:hidden">
                                <AgendaList days={days} lessons={weekLessons} counterpart={counterpart} now={now!} selectedId={selectedId} onSelect={(l) => setSelectedId(l.id)} />
                            </div>
                            {weekLessons.length === 0 && (
                                <p className="mt-3 hidden text-center text-sm text-muted-foreground md:block">
                                    No lessons this week.{' '}
                                    {role === 'teacher' ? 'Use “Schedule lessons” to add some.' : role === 'family' ? 'Your teacher adds lessons here.' : ''}
                                </p>
                            )}
                        </div>
                    )}

                    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground" aria-label="Legend">
                        {LEGEND.map(({ label, swatch }) => (
                            <li key={label} className="flex items-center gap-1.5">
                                <span className={cn('size-3 rounded-sm border', swatch)} aria-hidden />
                                {label}
                            </li>
                        ))}
                    </ul>
                </section>
            ) : (
                <RequestsPanel role={role} subject={subject} refreshKey={refreshKey} onChanged={bump} initialFilter={requestFilter} />
            )}

            {now !== null && (
                <LessonDetailsSheet
                    lesson={selected}
                    role={role}
                    now={now}
                    onClose={() => setSelectedId(null)}
                    onRequestChange={(lesson, type) => setRequestDialog({ lesson, type })}
                    onWithdraw={(lesson) => setWithdrawing(lesson)}
                    onReschedule={(lesson) => setMoving(lesson)}
                    onCancelLesson={(lesson) => setCancelling(lesson)}
                    onReviewRequest={reviewRequest}
                />
            )}

            {role === 'teacher' && <ScheduleLessonDialog open={scheduleOpen} onOpenChange={setScheduleOpen} onScheduled={bump} />}

            <RequestChangeDialog lesson={requestDialog?.lesson ?? null} initialType={requestDialog?.type ?? 'CANCEL'} onClose={() => setRequestDialog(null)} onSent={bump} />
            <TeacherRescheduleDialog lesson={moving} onClose={() => setMoving(null)} onDone={bump} />

            <ConfirmDialog
                open={!!cancelling}
                onOpenChange={(open) => !open && setCancelling(null)}
                title="Cancel this lesson?"
                description={cancelling ? `${cancelling.student} with ${cancelling.family.name}, ${fmtDateTime(cancelling.startsAt)}. The family will be notified.` : ''}
                confirmLabel="Cancel lesson"
                destructive
                loading={busy}
                onConfirm={cancelLesson}
            />
            <ConfirmDialog
                open={!!withdrawing}
                onOpenChange={(open) => !open && setWithdrawing(null)}
                title="Withdraw your request?"
                description="Your lesson stays as it is. You can send a new request afterwards if you change your mind."
                confirmLabel="Withdraw request"
                cancelLabel="Keep request"
                loading={busy}
                onConfirm={withdraw}
            />
        </div>
    )
}

export default PlannerView
