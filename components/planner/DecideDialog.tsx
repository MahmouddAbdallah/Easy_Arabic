'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, Check, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PlannerApiError, plannerApi } from '@/lib/planner/client'
import { MAX_NOTE_LENGTH } from '@/lib/planner/constants'
import type { PlannerConflict, PlannerRequest } from '@/types/plannerTypes'
import { fmtDateTime, fmtTimeRange, fmtWhen } from './format'

export type Decision = 'approve' | 'reject'

interface DecideDialogProps {
    request: PlannerRequest | null
    decision: Decision | null
    onClose: () => void
    /** Called after the decision was saved, so lists and the calendar can reload. */
    onDone: () => void
}

/** Approve or reject a family's request, with an optional note the family will read. */
const DecideDialog = ({ request, decision, onClose, onDone }: DecideDialogProps) => {
    const [note, setNote] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [serverError, setServerError] = useState<string | null>(null)
    const [conflicts, setConflicts] = useState<PlannerConflict[]>([])

    useEffect(() => {
        setNote('')
        setServerError(null)
        setConflicts([])
    }, [request?.id, decision])

    if (!request || !decision) return null
    const approve = decision === 'approve'

    const consequence = approve
        ? request.type === 'CANCEL'
            ? `The lesson on ${fmtWhen(request.lesson.startsAt, request.lesson.endsAt)} will be cancelled.`
            : `The lesson will move from ${fmtDateTime(request.lesson.startsAt)} to ${request.requestedStartsAt ? fmtDateTime(request.requestedStartsAt) : 'the requested time'}.`
        : 'The lesson stays exactly as it is.'

    const submit = async () => {
        setServerError(null)
        setConflicts([])
        setSubmitting(true)
        try {
            const res = await plannerApi.decide(request.id, { decision, ...(note.trim() && { note: note.trim() }) })
            toast.success(res.message)
            onDone()
            onClose()
        } catch (e) {
            const error = e as PlannerApiError
            setServerError(error.message)
            setConflicts(error.conflicts)
            // The list may already be out of date (e.g. someone else answered): refresh it behind the dialog.
            if (error.code === 'ALREADY_REVIEWED' || error.code === 'LESSON_CHANGED') onDone()
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-base">{approve ? 'Approve this request?' : 'Reject this request?'}</DialogTitle>
                    <DialogDescription>
                        {request.family.name} · {request.lesson.student}. {consequence}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-1.5">
                    <Label htmlFor="planner-note" className="text-xs font-medium">
                        Note to the family <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Textarea
                        id="planner-note"
                        value={note}
                        maxLength={MAX_NOTE_LENGTH}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={approve ? 'For example: no problem, see you then' : 'For example: that time is already taken, could we try Sunday?'}
                        rows={3}
                        className="resize-none bg-background text-xs"
                    />
                    <p className="text-end text-[11px] tabular-nums text-muted-foreground">
                        {note.length}/{MAX_NOTE_LENGTH}
                    </p>
                </div>

                {serverError && (
                    <div role="alert" className="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                        <p className="flex items-center gap-1.5 font-semibold">
                            <AlertTriangle className="size-3.5" aria-hidden /> {serverError}
                        </p>
                        {conflicts.map((c, i) => (
                            <p key={i}>
                                {c.kind === 'teacher'
                                    ? `Overlaps a lesson${c.student ? ` with ${c.student}` : ''} (${fmtTimeRange(c.startsAt, c.endsAt)}).`
                                    : 'The family already has a lesson at that time.'}
                            </p>
                        ))}
                    </div>
                )}

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                        Back
                    </Button>
                    <Button type="button" variant={approve ? 'default' : 'destructive'} onClick={submit} disabled={submitting}>
                        {submitting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : approve ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
                        {approve ? 'Approve' : 'Reject'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default DecideDialog
