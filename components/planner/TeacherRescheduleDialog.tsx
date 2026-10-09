'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, CalendarClock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PlannerApiError, plannerApi } from '@/lib/planner/client'
import { parseInstant } from '@/lib/planner/time'
import type { PlannerConflict, PlannerLesson } from '@/types/plannerTypes'
import DateTimeFields, { dateTimeProblem, fromInstant, toInstant, type DateTimeValue } from './DateTimeFields'
import { fmtDuration, fmtTimeRange, fmtWhen } from './format'

interface TeacherRescheduleDialogProps {
    lesson: PlannerLesson | null
    onClose: () => void
    onDone: () => void
}

/** A teacher moves one of THEIR OWN upcoming lessons. The server refuses a time that overlaps another lesson. */
const TeacherRescheduleDialog = ({ lesson, onClose, onDone }: TeacherRescheduleDialogProps) => {
    const [when, setWhen] = useState<DateTimeValue>({ date: undefined, time: '17:00' })
    const [attempted, setAttempted] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [serverError, setServerError] = useState<string | null>(null)
    const [conflicts, setConflicts] = useState<PlannerConflict[]>([])

    useEffect(() => {
        if (!lesson) return
        const start = parseInstant(lesson.startsAt)
        setWhen(start ? fromInstant(start) : { date: undefined, time: '17:00' })
        setAttempted(false)
        setServerError(null)
        setConflicts([])
    }, [lesson])

    if (!lesson) return null

    const target = toInstant(when)
    const problem = dateTimeProblem(when) ?? (target && target.getTime() === parseInstant(lesson.startsAt)?.getTime() ? 'Choose a different time than the current one.' : null)

    const submit = async () => {
        setAttempted(true)
        setServerError(null)
        setConflicts([])
        if (problem || !target) return
        setSubmitting(true)
        try {
            const res = await plannerApi.changeLesson(lesson.id, { action: 'reschedule', startsAt: target.toISOString() })
            toast.success(res.message)
            onDone()
            onClose()
        } catch (e) {
            const error = e as PlannerApiError
            setServerError(error.message)
            setConflicts(error.conflicts)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <CalendarClock className="size-4 text-brand" aria-hidden /> Move lesson
                    </DialogTitle>
                    <DialogDescription>
                        {lesson.student} with {lesson.family.name}. Currently {fmtWhen(lesson.startsAt, lesson.endsAt)} ({fmtDuration(lesson.duration)}).
                    </DialogDescription>
                </DialogHeader>

                <DateTimeFields value={when} onChange={setWhen} dateLabel="New date" timeLabel="New start time" invalid={attempted && !!problem} />
                {attempted && problem && (
                    <p role="alert" className="text-xs text-destructive">
                        {problem}
                    </p>
                )}
                <p className="text-[11px] text-muted-foreground">The family is notified of the new time.</p>

                {serverError && (
                    <div role="alert" className="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                        <p className="flex items-center gap-1.5 font-semibold">
                            <AlertTriangle className="size-3.5" aria-hidden /> {serverError}
                        </p>
                        {conflicts.map((c, i) => (
                            <p key={i}>
                                {c.kind === 'teacher'
                                    ? `Overlaps your lesson${c.student ? ` with ${c.student}` : ''} (${fmtTimeRange(c.startsAt, c.endsAt)}).`
                                    : 'This family already has a lesson at that time.'}
                            </p>
                        ))}
                    </div>
                )}

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                        Close
                    </Button>
                    <Button type="button" onClick={submit} disabled={submitting}>
                        {submitting && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                        Move lesson
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default TeacherRescheduleDialog
