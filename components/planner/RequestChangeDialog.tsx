'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { CalendarClock, Loader2, Send, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from 'cn'
import { PlannerApiError, plannerApi } from '@/lib/planner/client'
import { MAX_NOTE_LENGTH } from '@/lib/planner/constants'
import { parseInstant } from '@/lib/planner/time'
import type { LessonChangeType, PlannerLesson } from '@/types/plannerTypes'
import DateTimeFields, { dateTimeProblem, fromInstant, toInstant, type DateTimeValue } from './DateTimeFields'
import { fmtDuration, fmtWhen } from './format'

interface RequestChangeDialogProps {
    /** The lesson the family wants to change; the dialog is open while this is set. */
    lesson: PlannerLesson | null
    initialType: LessonChangeType
    onClose: () => void
    onSent: () => void
}

const OPTIONS: { type: LessonChangeType; title: string; hint: string; icon: typeof XCircle }[] = [
    { type: 'CANCEL', title: 'Cancel this lesson', hint: 'Ask your teacher to cancel it', icon: XCircle },
    { type: 'RESCHEDULE', title: 'Move to another time', hint: 'Suggest a new date and time', icon: CalendarClock },
]

/**
 * A family never edits a lesson. It sends a request, and the lesson stays exactly as it is until the teacher approves.
 */
const RequestChangeDialog = ({ lesson, initialType, onClose, onSent }: RequestChangeDialogProps) => {
    const [type, setType] = useState<LessonChangeType>(initialType)
    const [when, setWhen] = useState<DateTimeValue>({ date: undefined, time: '17:00' })
    const [reason, setReason] = useState('')
    const [attempted, setAttempted] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [serverError, setServerError] = useState<string | null>(null)

    useEffect(() => {
        if (!lesson) return
        setType(initialType)
        const start = parseInstant(lesson.startsAt)
        setWhen(start ? fromInstant(start) : { date: undefined, time: '17:00' })
        setReason('')
        setAttempted(false)
        setServerError(null)
    }, [lesson, initialType])

    if (!lesson) return null

    const originalMs = parseInstant(lesson.startsAt)?.getTime()
    const target = toInstant(when)
    const rescheduleProblem = type === 'RESCHEDULE' ? (dateTimeProblem(when) ?? (target && target.getTime() === originalMs ? 'Choose a different time than the current one.' : null)) : null

    const submit = async () => {
        setAttempted(true)
        setServerError(null)
        if (rescheduleProblem) return
        setSubmitting(true)
        try {
            const res = await plannerApi.submitRequest({
                lessonId: lesson.id,
                type,
                ...(type === 'RESCHEDULE' && target && { requestedStartsAt: target.toISOString() }),
                ...(reason.trim() && { reason: reason.trim() }),
            })
            toast.success(res.message)
            onSent()
            onClose()
        } catch (e) {
            setServerError((e as PlannerApiError).message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-base">Ask your teacher for a change</DialogTitle>
                    <DialogDescription>
                        Your lesson stays exactly as it is until {lesson.teacher.name} approves your request.
                    </DialogDescription>
                </DialogHeader>

                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
                    <p className="font-semibold text-foreground">{lesson.student}</p>
                    <p className="mt-0.5 text-muted-foreground">
                        {fmtWhen(lesson.startsAt, lesson.endsAt)} · {fmtDuration(lesson.duration)}
                    </p>
                    <p className="text-muted-foreground">with {lesson.teacher.name}</p>
                </div>

                <div role="radiogroup" aria-label="What would you like to do?" className="grid grid-cols-2 gap-2">
                    {OPTIONS.map(({ type: value, title, hint, icon: Icon }) => (
                        <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={type === value}
                            onClick={() => setType(value)}
                            className={cn(
                                'flex flex-col items-start gap-1 rounded-lg border p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                                type === value ? 'border-brand/50 bg-brand-soft text-brand' : 'border-border hover:bg-muted/50'
                            )}
                        >
                            <Icon className="size-4" aria-hidden />
                            <span className="text-xs font-semibold">{title}</span>
                            <span className={cn('text-[11px]', type === value ? 'text-brand/80' : 'text-muted-foreground')}>{hint}</span>
                        </button>
                    ))}
                </div>

                {type === 'RESCHEDULE' && (
                    <div className="space-y-1.5">
                        <DateTimeFields value={when} onChange={setWhen} dateLabel="New date" timeLabel="New start time" invalid={attempted && !!rescheduleProblem} />
                        {attempted && rescheduleProblem && (
                            <p role="alert" className="text-xs text-destructive">
                                {rescheduleProblem}
                            </p>
                        )}
                        <p className="text-[11px] text-muted-foreground">The lesson keeps its length ({fmtDuration(lesson.duration)}).</p>
                    </div>
                )}

                <div className="space-y-1.5">
                    <Label htmlFor="planner-reason" className="text-xs font-medium">
                        Reason <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Textarea
                        id="planner-reason"
                        value={reason}
                        maxLength={MAX_NOTE_LENGTH}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={type === 'CANCEL' ? 'For example: we are travelling this week' : 'For example: Friday doesn’t work for us, Saturday at 5 PM would'}
                        rows={3}
                        className="resize-none bg-background text-xs"
                    />
                    <p className="text-end text-[11px] tabular-nums text-muted-foreground">
                        {reason.length}/{MAX_NOTE_LENGTH}
                    </p>
                </div>

                {serverError && (
                    <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                        {serverError}
                    </p>
                )}

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                        Close
                    </Button>
                    <Button type="button" onClick={submit} disabled={submitting}>
                        {submitting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Send className="size-3.5" aria-hidden />}
                        {type === 'CANCEL' ? 'Send cancellation request' : 'Send reschedule request'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default RequestChangeDialog
