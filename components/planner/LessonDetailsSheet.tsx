'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowRight, BookOpen, CalendarClock, CalendarDays, Clock, Copy, GraduationCap, Hash, Hourglass, Timer, Undo2, User, Users, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { LessonChangeType, PlannerLesson, PlannerRole } from '@/types/plannerTypes'
import { fmtDateTime, fmtDayLong, fmtDuration, fmtTimeRange } from './format'
import { LessonStatusBadge, RequestTypeBadge, isUpcomingScheduled, lessonTone } from './status'

interface LessonDetailsSheetProps {
    lesson: PlannerLesson | null
    role: PlannerRole
    now: number
    onClose: () => void
    /** Family: ask for a cancellation or a new time. */
    onRequestChange: (lesson: PlannerLesson, type: LessonChangeType) => void
    /** Family: take back a pending request. */
    onWithdraw: (lesson: PlannerLesson) => void
    /** Teacher: move / cancel one of their own upcoming lessons. */
    onReschedule: (lesson: PlannerLesson) => void
    onCancelLesson: (lesson: PlannerLesson) => void
    /** Teacher / admin: jump to the Requests tab to answer the pending request. */
    onReviewRequest: (lesson: PlannerLesson) => void
}

const Row = ({ icon: Icon, label, children }: { icon: typeof Hash; label: string; children: React.ReactNode }) => (
    <div className="flex items-start gap-3 py-2.5">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
        </div>
    </div>
)

/** Everything about one lesson, and the actions the viewer's role is allowed to take on it. */
const LessonDetailsSheet = ({ lesson, role, now, onClose, onRequestChange, onWithdraw, onReschedule, onCancelLesson, onReviewRequest }: LessonDetailsSheetProps) => {
    // Keep showing the last lesson while the sheet slides out, instead of blanking mid-animation.
    const [last, setLast] = useState<PlannerLesson | null>(lesson)
    useEffect(() => {
        if (lesson) setLast(lesson)
    }, [lesson])
    const view = lesson ?? last
    if (!view) return null

    const upcoming = isUpcomingScheduled(view, now)
    const pending = view.pendingRequest
    const tone = lessonTone(view, now)

    const copyId = async () => {
        try {
            await navigator.clipboard.writeText(view.id)
            toast.success('Lesson ID copied')
        } catch {
            toast.error('Could not copy. Select the ID and copy it manually.')
        }
    }

    return (
        <Sheet open={!!lesson} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="gap-0 overflow-y-auto data-[side=right]:sm:max-w-md">
                <SheetHeader className="space-y-2 border-b border-border/60 pb-4">
                    <div className="flex items-center gap-2">
                        <LessonStatusBadge lesson={view} now={now} />
                        {pending && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-gold/50 bg-gold/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                                <Hourglass className="size-3" aria-hidden /> Request pending
                            </span>
                        )}
                    </div>
                    <SheetTitle className="text-lg">Lesson details</SheetTitle>
                    <SheetDescription>
                        {view.student} · {fmtDayLong(view.startsAt)}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 space-y-4 px-4 pb-4">
                    <dl className="divide-y divide-border/50">
                        <Row icon={Hash} label="Lesson ID">
                            <span className="flex items-center gap-2">
                                <code className="min-w-0 break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{view.id}</code>
                                <Button type="button" variant="ghost" size="icon-sm" onClick={copyId} aria-label="Copy lesson ID">
                                    <Copy className="size-3.5" aria-hidden />
                                </Button>
                            </span>
                        </Row>
                        <Row icon={CalendarDays} label="Date">
                            {fmtDayLong(view.startsAt)}
                        </Row>
                        <Row icon={Clock} label="Time">
                            {fmtTimeRange(view.startsAt, view.endsAt)}
                        </Row>
                        <Row icon={Timer} label="Duration">
                            {fmtDuration(view.duration)}
                        </Row>
                        <Row icon={User} label="Student">
                            {view.student}
                        </Row>
                        {/* The "related user": a teacher sees the family, a family sees the teacher, an admin sees both. */}
                        {role !== 'family' && (
                            <Row icon={Users} label="Family">
                                {view.family.name}
                            </Row>
                        )}
                        {role !== 'teacher' && (
                            <Row icon={GraduationCap} label="Teacher">
                                {view.teacher.name}
                            </Row>
                        )}
                        <Row icon={tone.icon} label="Status">
                            {tone.label}
                        </Row>
                    </dl>

                    {pending && (
                        <section aria-label="Pending request" className="space-y-2 rounded-lg border border-gold/50 bg-gold/10 p-3 text-xs">
                            <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold text-foreground">{role === 'family' ? 'Your request is waiting for an answer' : 'The family sent a request'}</p>
                                <RequestTypeBadge type={pending.type} />
                            </div>
                            {pending.type === 'RESCHEDULE' && pending.requestedStartsAt && (
                                <p className="flex flex-wrap items-center gap-1.5 text-foreground/90">
                                    {fmtDateTime(view.startsAt)} <ArrowRight className="size-3.5 text-brand rtl:rotate-180" aria-hidden />
                                    <span className="font-semibold text-brand">{fmtDateTime(pending.requestedStartsAt)}</span>
                                </p>
                            )}
                            {pending.reason && <p className="whitespace-pre-wrap wrap-break-word text-muted-foreground">“{pending.reason}”</p>}
                            <p className="text-muted-foreground">The lesson stays as it is until it is answered.</p>
                        </section>
                    )}

                    {/* Lessons that can't be changed any more, and why */}
                    {!upcoming && view.status === 'SCHEDULED' && (
                        <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                            {role === 'teacher' ? (
                                <>
                                    This lesson has started or passed, so it can no longer be moved here. Record how it went on the{' '}
                                    <Link href="/lesson" className="font-medium text-brand underline-offset-2 hover:underline">
                                        Lessons page
                                    </Link>
                                    .
                                </>
                            ) : (
                                'This lesson has already started, so it can no longer be changed.'
                            )}
                        </p>
                    )}
                    {view.status !== 'SCHEDULED' && (
                        <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                            {view.status === 'CANCELLED' ? 'This lesson was cancelled.' : 'This lesson already took place, so there is nothing to change.'}
                        </p>
                    )}
                </div>

                {/* Actions for this role */}
                {(upcoming || (pending && role !== 'family')) && (
                    <SheetFooter className="border-t border-border/60 sm:flex-row sm:flex-wrap sm:justify-end">
                        {role === 'family' && upcoming && !pending && (
                            <>
                                <Button variant="outline" onClick={() => onRequestChange(view, 'CANCEL')}>
                                    <XCircle className="size-3.5" aria-hidden /> Request cancellation
                                </Button>
                                <Button onClick={() => onRequestChange(view, 'RESCHEDULE')}>
                                    <CalendarClock className="size-3.5" aria-hidden /> Request new time
                                </Button>
                            </>
                        )}
                        {role === 'family' && upcoming && pending && (
                            <Button variant="outline" onClick={() => onWithdraw(view)}>
                                <Undo2 className="size-3.5" aria-hidden /> Withdraw request
                            </Button>
                        )}
                        {role === 'teacher' && upcoming && !pending && (
                            <>
                                <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => onCancelLesson(view)}>
                                    <XCircle className="size-3.5" aria-hidden /> Cancel lesson
                                </Button>
                                <Button onClick={() => onReschedule(view)}>
                                    <CalendarClock className="size-3.5" aria-hidden /> Move lesson
                                </Button>
                            </>
                        )}
                        {role !== 'family' && pending && (
                            <Button onClick={() => onReviewRequest(view)}>
                                <BookOpen className="size-3.5" aria-hidden /> Review request
                            </Button>
                        )}
                    </SheetFooter>
                )}
            </SheetContent>
        </Sheet>
    )
}

export default LessonDetailsSheet
