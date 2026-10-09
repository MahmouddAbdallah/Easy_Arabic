'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { AlertTriangle, ArrowRight, Check, ChevronLeft, ChevronRight, GraduationCap, Inbox, MessageSquareQuote, Undo2, User, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from 'cn'
import { PlannerApiError, plannerApi, type PlannerSubject } from '@/lib/planner/client'
import type { LessonChangeStatus, PlannerRequest, PlannerRequestList, PlannerRole } from '@/types/plannerTypes'
import ConfirmDialog from './ConfirmDialog'
import DecideDialog, { type Decision } from './DecideDialog'
import { fmtDateTime, fmtDuration, fmtTimeRange } from './format'
import { RequestStatusBadge, RequestTypeBadge, REQUEST_STATUS_LABEL } from './status'

type Filter = 'ALL' | LessonChangeStatus
const FILTERS: Filter[] = ['PENDING', 'ALL', 'APPROVED', 'REJECTED', 'CANCELLED']
const PAGE_SIZE = 8

interface RequestsPanelProps {
    role: PlannerRole
    subject?: PlannerSubject
    /** Bumped by the parent when something elsewhere changed (e.g. a lesson was moved) so this list reloads. */
    refreshKey: number
    /** Tell the parent a request changed, so the calendar and the counters reload too. */
    onChanged: () => void
    /** Which filter to open on (the lesson sheet's "Review request" button asks for PENDING). */
    initialFilter?: Filter
}

const EMPTY_COPY: Record<Filter, { title: string; hint: (role: PlannerRole) => string }> = {
    PENDING: {
        title: 'Nothing waiting',
        hint: (role) => (role === 'family' ? 'Requests you send to your teacher show up here until they answer.' : 'When a family asks to cancel or move a lesson, it shows up here.'),
    },
    ALL: { title: 'No requests yet', hint: (role) => (role === 'family' ? 'Open a lesson in your calendar to ask for a change.' : 'Requests from families will be listed here.') },
    APPROVED: { title: 'No approved requests', hint: () => 'Approved requests are kept here as a history.' },
    REJECTED: { title: 'No rejected requests', hint: () => 'Rejected requests are kept here as a history.' },
    CANCELLED: { title: 'No withdrawn requests', hint: () => 'Requests a family withdrew before an answer are kept here.' },
}

/** The family's requests (their own) or the requests about a teacher's lessons, with the actions that role may take. */
const RequestsPanel = ({ role, subject, refreshKey, onChanged, initialFilter = 'PENDING' }: RequestsPanelProps) => {
    const [filter, setFilter] = useState<Filter>(initialFilter)
    const [page, setPage] = useState(1)
    const [data, setData] = useState<PlannerRequestList | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [localKey, setLocalKey] = useState(0)

    const [deciding, setDeciding] = useState<{ request: PlannerRequest; decision: Decision } | null>(null)
    const [withdrawing, setWithdrawing] = useState<PlannerRequest | null>(null)
    const [withdrawBusy, setWithdrawBusy] = useState(false)

    const subjectKey = subject ? JSON.stringify(subject) : ''

    useEffect(() => {
        setFilter(initialFilter)
        setPage(1)
    }, [initialFilter])

    useEffect(() => {
        const controller = new AbortController()
        setLoading(true)
        setError(null)
        plannerApi
            .requests({ status: filter === 'ALL' ? undefined : filter, page, pageSize: PAGE_SIZE }, subject, controller.signal)
            .then((res) => {
                setData(res)
                // Deleted the last row of the last page? Step back instead of showing an empty page.
                if (res.requests.length === 0 && page > 1) setPage(page - 1)
            })
            .catch((e) => {
                if (e?.code === 'ERR_CANCELED' || controller.signal.aborted) return
                setError((e as PlannerApiError).message)
            })
            .finally(() => !controller.signal.aborted && setLoading(false))
        return () => controller.abort()
    }, [filter, page, refreshKey, localKey, subjectKey])

    const changed = useCallback(() => {
        setLocalKey((k) => k + 1)
        onChanged()
    }, [onChanged])

    const withdraw = async () => {
        if (!withdrawing) return
        setWithdrawBusy(true)
        try {
            const res = await plannerApi.withdrawRequest(withdrawing.id)
            toast.success(res.message)
            setWithdrawing(null)
            changed()
        } catch (e) {
            toast.error((e as PlannerApiError).message)
            changed() // it may already have been answered; show the truth
            setWithdrawing(null)
        } finally {
            setWithdrawBusy(false)
        }
    }

    const totals = data?.totals
    const countFor = (f: Filter) => (totals ? (f === 'ALL' ? totals.all : totals[f]) : undefined)
    const totalPages = data ? Math.max(1, Math.ceil(data.count / data.pageSize)) : 1

    return (
        <section aria-label="Lesson change requests" className="space-y-4">
            <Tabs value={filter} onValueChange={(v) => { setFilter(v as Filter); setPage(1) }}>
                <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-fit">
                    {FILTERS.map((f) => {
                        const count = countFor(f)
                        return (
                            <TabsTrigger key={f} value={f} className="gap-1.5 px-3 text-xs">
                                {f === 'ALL' ? 'All' : REQUEST_STATUS_LABEL[f]}
                                {count !== undefined && (
                                    <span
                                        className={cn(
                                            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                                            f === 'PENDING' && count > 0 ? 'bg-gold/25 text-amber-800 dark:text-amber-200' : 'bg-muted text-muted-foreground'
                                        )}
                                    >
                                        {count}
                                    </span>
                                )}
                            </TabsTrigger>
                        )
                    })}
                </TabsList>
            </Tabs>

            {error ? (
                <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    <p>{error}</p>
                    <Button variant="outline" size="sm" onClick={() => setLocalKey((k) => k + 1)}>
                        Try again
                    </Button>
                </div>
            ) : loading && !data ? (
                <div className="space-y-3" aria-busy="true" aria-label="Loading requests">
                    {[0, 1].map((i) => (
                        <Skeleton key={i} className="h-40 w-full rounded-xl" />
                    ))}
                </div>
            ) : data && data.requests.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 bg-card px-6 py-12 text-center">
                    <div className="rounded-full bg-muted p-3 text-muted-foreground">
                        <Inbox className="size-5" aria-hidden />
                    </div>
                    <p className="text-sm font-semibold text-foreground">{EMPTY_COPY[filter].title}</p>
                    <p className="max-w-xs text-xs text-muted-foreground">{EMPTY_COPY[filter].hint(role)}</p>
                </div>
            ) : (
                <div className={cn('space-y-3 transition-opacity', loading && 'pointer-events-none opacity-60')} aria-busy={loading}>
                    {data?.requests.map((request) => (
                        <RequestCard
                            key={request.id}
                            request={request}
                            role={role}
                            onDecide={(decision) => setDeciding({ request, decision })}
                            onWithdraw={() => setWithdrawing(request)}
                        />
                    ))}

                    {data && data.count > data.pageSize && (
                        <nav aria-label="Requests pages" className="flex items-center justify-between gap-3 pt-1">
                            <p className="text-xs text-muted-foreground tabular-nums">
                                {(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.count)} of {data.count}
                            </p>
                            <div className="flex items-center gap-1.5">
                                <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                                    <ChevronLeft className="size-3.5 rtl:rotate-180" aria-hidden /> Previous
                                </Button>
                                <span className="px-1 text-xs tabular-nums text-muted-foreground">
                                    {page} / {totalPages}
                                </span>
                                <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                                    Next <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
                                </Button>
                            </div>
                        </nav>
                    )}
                </div>
            )}

            <DecideDialog request={deciding?.request ?? null} decision={deciding?.decision ?? null} onClose={() => setDeciding(null)} onDone={changed} />

            <ConfirmDialog
                open={!!withdrawing}
                onOpenChange={(open) => !open && setWithdrawing(null)}
                title="Withdraw this request?"
                description="Your lesson stays as it is. You can send a new request afterwards if you change your mind."
                confirmLabel="Withdraw request"
                cancelLabel="Keep request"
                loading={withdrawBusy}
                onConfirm={withdraw}
            />
        </section>
    )
}

/* ───────────────────────────────  One request  ─────────────────────────────── */

interface RequestCardProps {
    request: PlannerRequest
    role: PlannerRole
    onDecide: (decision: Decision) => void
    onWithdraw: () => void
}

const RequestCard = ({ request, role, onDecide, onWithdraw }: RequestCardProps) => {
    const pending = request.status === 'PENDING'
    const staff = role !== 'family'
    const lessonMoved = request.lesson.startsAt !== request.originalStartsAt
    const blockedReason = request.blocker?.message ?? (request.conflict ? 'The requested time overlaps another lesson.' : null)

    // Who the card is "about": a teacher/admin sees the family, a family sees its teacher. Admins see both.
    const counterpartName = role === 'family' ? request.teacher.name : request.family.name
    const CounterpartIcon = role === 'family' ? GraduationCap : Users

    const reviewer = request.reviewedBy
        ? request.reviewedBy.role === 'admin'
            ? staff && request.reviewedBy.name ? `Admin ${request.reviewedBy.name}` : 'the admin'
            : staff && request.reviewedBy.name ? request.reviewedBy.name : 'your teacher'
        : null

    return (
        <article
            className={cn('space-y-3 rounded-xl border bg-card p-4 shadow-xs', pending ? 'border-gold/50' : 'border-border/60')}
            aria-label={`${request.type === 'CANCEL' ? 'Cancellation' : 'Reschedule'} request for ${request.lesson.student}`}
        >
            {/* Header */}
            <header className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                    <span className="shrink-0 rounded-md bg-primary/10 p-1.5 text-primary">
                        <CounterpartIcon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{counterpartName}</p>
                        {role === 'admin' && <p className="truncate text-[11px] text-muted-foreground">Teacher: {request.teacher.name}</p>}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    <RequestTypeBadge type={request.type} />
                    <RequestStatusBadge status={request.status} />
                </div>
            </header>

            {/* The lesson and what is being asked */}
            <dl className="grid gap-3 text-xs sm:grid-cols-2">
                <div className="space-y-1 rounded-lg bg-muted/30 p-3">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Original lesson</dt>
                    <dd className="space-y-0.5">
                        <p className="flex items-center gap-1.5 font-semibold text-foreground">
                            <User className="size-3.5 text-blue-500" aria-hidden /> {request.lesson.student || 'Student'}
                        </p>
                        <p className="text-foreground/80">{fmtDateTime(request.originalStartsAt)}</p>
                        {request.lesson.duration > 0 && (
                            <p className="text-muted-foreground">
                                {fmtTimeRange(request.originalStartsAt, new Date(new Date(request.originalStartsAt).getTime() + request.lesson.duration * 60_000).toISOString())} · {fmtDuration(request.lesson.duration)}
                            </p>
                        )}
                        {role === 'admin' && (
                            <p className="truncate font-mono text-[10px] text-muted-foreground" title={request.lessonId}>
                                ID {request.lessonId}
                            </p>
                        )}
                    </dd>
                </div>

                <div className="space-y-1 rounded-lg bg-muted/30 p-3">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Requested</dt>
                    <dd className="space-y-0.5">
                        {request.type === 'CANCEL' ? (
                            <p className="font-semibold text-rose-700 dark:text-rose-300">Cancel this lesson</p>
                        ) : (
                            <>
                                <p className="font-semibold text-foreground">Move to a new time</p>
                                {request.requestedStartsAt && (
                                    <p className="flex flex-wrap items-center gap-1.5 text-foreground/80">
                                        <ArrowRight className="size-3.5 text-brand rtl:rotate-180" aria-hidden />
                                        <span className="font-medium text-brand">{fmtDateTime(request.requestedStartsAt)}</span>
                                    </p>
                                )}
                            </>
                        )}
                        <p className="text-muted-foreground">Sent {format(new Date(request.createdAt), 'MMM d, yyyy · h:mm a')}</p>
                    </dd>
                </div>
            </dl>

            {lessonMoved && pending && (
                <p className="text-[11px] text-muted-foreground">The lesson is now at {fmtDateTime(request.lesson.startsAt)}.</p>
            )}

            {request.reason && (
                <div className="flex gap-2 rounded-lg border border-border/60 p-3 text-xs">
                    <MessageSquareQuote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Reason</p>
                        <p className="whitespace-pre-wrap wrap-break-word text-foreground/90">{request.reason}</p>
                    </div>
                </div>
            )}

            {/* The answer */}
            {request.reviewedAt && reviewer && (
                <div className={cn('rounded-lg border p-3 text-xs', request.status === 'APPROVED' ? 'border-teal-500/25 bg-teal-500/5' : 'border-rose-500/25 bg-rose-500/5')}>
                    <p className="font-medium text-foreground">
                        {request.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {reviewer} · {format(new Date(request.reviewedAt), 'MMM d, yyyy')}
                    </p>
                    {request.reviewerNote && <p className="mt-1 whitespace-pre-wrap wrap-break-word text-foreground/80">“{request.reviewerNote}”</p>}
                </div>
            )}
            {request.status === 'CANCELLED' && <p className="text-[11px] text-muted-foreground">Withdrawn by the family before it was answered.</p>}

            {/* Why it can't be approved right now */}
            {staff && pending && blockedReason && (
                <p role="status" className="flex items-start gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span>
                        {blockedReason}
                        {request.conflict && (
                            <>
                                {' '}
                                {request.conflict.kind === 'teacher'
                                    ? `You have a lesson${request.conflict.student ? ` with ${request.conflict.student}` : ''} at ${fmtTimeRange(request.conflict.startsAt, request.conflict.endsAt)}.`
                                    : 'The family already has a lesson then.'}{' '}
                                You can reject this request with a note, or move the other lesson first.
                            </>
                        )}
                    </span>
                </p>
            )}

            {/* Actions */}
            {pending && (
                <footer className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    {role === 'family' ? (
                        <Button variant="outline" size="sm" onClick={onWithdraw}>
                            <Undo2 className="size-3.5" aria-hidden /> Withdraw request
                        </Button>
                    ) : (
                        <>
                            <Button variant="outline" size="sm" onClick={() => onDecide('reject')} className="text-destructive hover:text-destructive">
                                <X className="size-3.5" aria-hidden /> Reject
                            </Button>
                            <Button size="sm" disabled={!!blockedReason} title={blockedReason ?? undefined} onClick={() => onDecide('approve')}>
                                <Check className="size-3.5" aria-hidden /> Approve
                            </Button>
                        </>
                    )}
                </footer>
            )}
        </article>
    )
}

export default RequestsPanel
