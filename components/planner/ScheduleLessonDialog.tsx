'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { AlertTriangle, CalendarPlus, Loader2, Repeat, Timer, User, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from 'cn'
import { PlannerApiError, plannerApi } from '@/lib/planner/client'
import { LESSON_DURATIONS, MAX_OCCURRENCES, MAX_STUDENT_LENGTH } from '@/lib/planner/constants'
import { weeklyOccurrences } from '@/lib/planner/time'
import type { PlannerConflict, PlannerFamilyOption } from '@/types/plannerTypes'
import DateTimeFields, { dateTimeProblem, toInstant, type DateTimeValue } from './DateTimeFields'
import { fmtDuration, fmtDateTime, fmtTimeRange } from './format'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEK_CHOICES = [1, 2, 3, 4, 6, 8, 10, 12]

interface ScheduleLessonDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Called after lessons were created, so the planner can reload. */
    onScheduled: () => void
}

const emptyDate = (): DateTimeValue => ({ date: undefined, time: '17:00' })

/**
 * A teacher schedules future lessons for one of their families. One lesson, or "every Sunday / Tuesday / Thursday for
 * 4 weeks" (the browser expands that into exact times in the teacher's own time zone; the server re-checks each one
 * and refuses the whole batch if any single lesson would overlap another).
 */
const ScheduleLessonDialog = ({ open, onOpenChange, onScheduled }: ScheduleLessonDialogProps) => {
    const [families, setFamilies] = useState<PlannerFamilyOption[] | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)

    const [familyId, setFamilyId] = useState('')
    const [student, setStudent] = useState('')
    const [when, setWhen] = useState<DateTimeValue>(emptyDate)
    const [duration, setDuration] = useState('60')
    const [repeat, setRepeat] = useState(false)
    const [weeks, setWeeks] = useState('4')
    const [weekdays, setWeekdays] = useState<number[]>([])

    const [attempted, setAttempted] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [serverError, setServerError] = useState<string | null>(null)
    const [conflicts, setConflicts] = useState<PlannerConflict[]>([])

    // Fresh form (and a fresh families list) every time the dialog opens.
    useEffect(() => {
        if (!open) return
        setFamilyId('')
        setStudent('')
        setWhen(emptyDate())
        setDuration('60')
        setRepeat(false)
        setWeeks('4')
        setWeekdays([])
        setAttempted(false)
        setServerError(null)
        setConflicts([])
        setFamilies(null)
        setLoadError(null)

        let cancelled = false
        plannerApi
            .families()
            .then(({ families }) => {
                if (cancelled) return
                setFamilies(families)
                if (families.length === 1) {
                    setFamilyId(families[0].id)
                    if (families[0].students.length === 1) setStudent(families[0].students[0])
                }
            })
            .catch((e: PlannerApiError) => !cancelled && setLoadError(e.message))
        return () => {
            cancelled = true
        }
    }, [open])

    const family = families?.find((f) => f.id === familyId)
    const first = useMemo(() => toInstant(when), [when])
    const startDay = when.date?.getDay()

    // The chosen start day is always part of a weekly schedule; the chips only add more days.
    const occurrences = useMemo(() => {
        if (!first) return []
        return repeat ? weeklyOccurrences(first, weekdays, Number(weeks)) : [first]
    }, [first, repeat, weekdays, weeks])

    const problems = useMemo(() => {
        const list: string[] = []
        if (!familyId) list.push('Choose a family.')
        if (!student.trim()) list.push('Enter the student’s name.')
        const dt = dateTimeProblem(when)
        if (dt) list.push(dt)
        if (occurrences.length > MAX_OCCURRENCES) list.push(`That makes ${occurrences.length} lessons. Schedule at most ${MAX_OCCURRENCES} at once.`)
        return list
    }, [familyId, student, when, occurrences.length])

    const toggleWeekday = (day: number) => {
        if (day === startDay) return // the start day can't be removed
        setWeekdays((cur) => (cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day]))
    }

    const submit = async () => {
        setAttempted(true)
        setServerError(null)
        setConflicts([])
        if (problems.length > 0) return

        setSubmitting(true)
        try {
            const res = await plannerApi.schedule({
                familyId,
                student: student.trim(),
                duration: Number(duration),
                startTimes: occurrences.map((d) => d.toISOString()),
            })
            toast.success(res.message)
            onScheduled()
            onOpenChange(false)
        } catch (e) {
            const error = e as PlannerApiError
            setServerError(error.message)
            setConflicts(error.conflicts ?? [])
        } finally {
            setSubmitting(false)
        }
    }

    const shownProblems = attempted ? problems : []

    return (
        <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <CalendarPlus className="size-4 text-brand" aria-hidden /> Schedule lessons
                    </DialogTitle>
                    <DialogDescription>Add upcoming lessons for one of your families. They appear in both planners right away.</DialogDescription>
                </DialogHeader>

                {loadError ? (
                    <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                        {loadError}
                    </p>
                ) : families === null ? (
                    <div className="space-y-3" aria-busy="true" aria-label="Loading your families">
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                ) : families.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
                        You don’t have any active families assigned to you yet, so there is nobody to schedule lessons for.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Family */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">
                                <Users className="size-3.5 text-primary" aria-hidden /> Family
                            </Label>
                            <Select
                                value={familyId}
                                onValueChange={(value) => {
                                    if (!value) return
                                    setFamilyId(value)
                                    const next = families.find((f) => f.id === value)
                                    // Helpful default: a family with one known student.
                                    if (!student.trim() && next?.students.length === 1) setStudent(next.students[0])
                                }}
                            >
                                <SelectTrigger aria-label="Family" className="h-9 w-full bg-background text-xs" aria-invalid={(attempted && !familyId) || undefined}>
                                    <SelectValue>{family ? family.name : <span className="text-muted-foreground">Choose a family</span>}</SelectValue>
                                </SelectTrigger>
                                <SelectContent className="rounded-md border-border/80">
                                    {families.map((f) => (
                                        <SelectItem key={f.id} value={f.id} className="text-xs">
                                            {f.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Student */}
                        <div className="space-y-1.5">
                            <Label htmlFor="planner-student" className="text-xs font-medium">
                                <User className="size-3.5 text-blue-500" aria-hidden /> Student
                            </Label>
                            <Input
                                id="planner-student"
                                value={student}
                                maxLength={MAX_STUDENT_LENGTH}
                                onChange={(e) => setStudent(e.target.value)}
                                placeholder="Student’s name"
                                autoComplete="off"
                                aria-invalid={(attempted && !student.trim()) || undefined}
                                className="h-9 bg-background text-xs"
                            />
                            {family && family.students.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                    <span className="text-[11px] text-muted-foreground">Recent:</span>
                                    {family.students.map((name) => (
                                        <button
                                            key={name}
                                            type="button"
                                            onClick={() => setStudent(name)}
                                            className={cn(
                                                'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                                                student === name ? 'border-brand/40 bg-brand-soft text-brand' : 'border-border text-muted-foreground hover:bg-muted'
                                            )}
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* When */}
                        <DateTimeFields value={when} onChange={setWhen} invalid={attempted && !!dateTimeProblem(when)} />

                        {/* Duration */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">
                                <Timer className="size-3.5 text-indigo-500" aria-hidden /> Duration
                            </Label>
                            <Select value={duration} onValueChange={(v) => v && setDuration(v)}>
                                <SelectTrigger aria-label="Duration" className="h-9 w-full bg-background text-xs">
                                    <SelectValue>{fmtDuration(Number(duration))}</SelectValue>
                                </SelectTrigger>
                                <SelectContent className="rounded-md border-border/80">
                                    {LESSON_DURATIONS.map((m) => (
                                        <SelectItem key={m} value={String(m)} className="text-xs">
                                            {fmtDuration(m)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Repeat */}
                        <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                            <div className="flex items-start gap-2.5">
                                <Checkbox
                                    id="planner-repeat"
                                    checked={repeat}
                                    onCheckedChange={(checked) => {
                                        setRepeat(!!checked)
                                        if (checked && startDay !== undefined && weekdays.length === 0) setWeekdays([startDay])
                                    }}
                                    className="mt-0.5"
                                />
                                <div className="space-y-0.5">
                                    <Label htmlFor="planner-repeat" className="text-xs font-medium">
                                        <Repeat className="size-3.5 text-brand" aria-hidden /> Repeat every week
                                    </Label>
                                    <p className="text-[11px] text-muted-foreground">For example Sunday, Tuesday and Thursday at the same time.</p>
                                </div>
                            </div>

                            {repeat && (
                                <div className="space-y-3 ps-6">
                                    <fieldset className="space-y-1.5">
                                        <legend className="text-[11px] font-medium text-muted-foreground">On these days</legend>
                                        <div className="flex flex-wrap gap-1.5">
                                            {WEEKDAYS.map((name, day) => {
                                                const locked = day === startDay
                                                const on = locked || weekdays.includes(day)
                                                return (
                                                    <button
                                                        key={name}
                                                        type="button"
                                                        aria-pressed={on}
                                                        onClick={() => toggleWeekday(day)}
                                                        title={locked ? 'The day of your first lesson' : undefined}
                                                        className={cn(
                                                            'h-8 min-w-11 rounded-md border px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                                                            on ? 'border-brand/40 bg-brand-soft text-brand' : 'border-border bg-background text-muted-foreground hover:bg-muted',
                                                            locked && 'cursor-default'
                                                        )}
                                                    >
                                                        {name}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </fieldset>

                                    <div className="flex items-center gap-2">
                                        <Label className="text-[11px] font-medium text-muted-foreground">For</Label>
                                        <Select value={weeks} onValueChange={(v) => v && setWeeks(v)}>
                                            <SelectTrigger aria-label="Number of weeks" className="h-8 w-28 bg-background text-xs">
                                                <SelectValue>{weeks === '1' ? '1 week' : `${weeks} weeks`}</SelectValue>
                                            </SelectTrigger>
                                            <SelectContent className="rounded-md border-border/80">
                                                {WEEK_CHOICES.map((w) => (
                                                    <SelectItem key={w} value={String(w)} className="text-xs">
                                                        {w === 1 ? '1 week' : `${w} weeks`}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Preview */}
                        {occurrences.length > 0 && (
                            <div className="rounded-lg border border-brand/20 bg-brand-soft/60 p-3" aria-live="polite">
                                <p className="text-xs font-semibold text-brand">
                                    {occurrences.length === 1 ? '1 lesson will be scheduled' : `${occurrences.length} lessons will be scheduled`}
                                </p>
                                <ul className="mt-1.5 space-y-0.5 text-[11px] text-foreground/80">
                                    {occurrences.slice(0, 6).map((d) => (
                                        <li key={d.getTime()}>
                                            {format(d, 'EEE, MMM d')} · {fmtTimeRange(d.toISOString(), new Date(d.getTime() + Number(duration) * 60_000).toISOString())}
                                        </li>
                                    ))}
                                    {occurrences.length > 6 && <li className="text-muted-foreground">…and {occurrences.length - 6} more</li>}
                                </ul>
                            </div>
                        )}

                        {shownProblems.length > 0 && (
                            <ul role="alert" className="space-y-0.5 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                                {shownProblems.map((p) => (
                                    <li key={p}>{p}</li>
                                ))}
                            </ul>
                        )}

                        {serverError && (
                            <div role="alert" className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                                <p className="flex items-center gap-1.5 font-semibold">
                                    <AlertTriangle className="size-3.5" aria-hidden /> {serverError}
                                </p>
                                {conflicts.length > 0 && (
                                    <ul className="list-inside list-disc space-y-0.5">
                                        {conflicts.map((c, i) => (
                                            <li key={i}>
                                                {c.requestedStartsAt ? `${fmtDateTime(c.requestedStartsAt)}: ` : ''}
                                                {c.kind === 'teacher'
                                                    ? `overlaps your lesson${c.student ? ` with ${c.student}` : ''} (${fmtTimeRange(c.startsAt, c.endsAt)})`
                                                    : 'this family already has a lesson at that time'}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Close
                    </Button>
                    {families && families.length > 0 && (
                        <Button type="button" onClick={submit} disabled={submitting}>
                            {submitting && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                            {occurrences.length > 1 ? `Schedule ${occurrences.length} lessons` : 'Schedule lesson'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default ScheduleLessonDialog
