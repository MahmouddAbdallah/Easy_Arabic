import { CalendarClock, CheckCircle2, CircleDashed, Clock3, PlayCircle, UserX, XCircle, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from 'cn';
import { LESSON_STATUS } from '@/lib/planner/constants';
import { parseInstant } from '@/lib/planner/time';
import type { LessonChangeStatus, LessonChangeType } from '@/types/plannerTypes';

/**
 * How a lesson looks, decided in ONE place so the grid, the agenda and the details sheet always agree.
 * Time matters as much as the stored status: a SCHEDULED lesson whose time has passed is not "upcoming", it is waiting
 * for its outcome (attended / absent) to be recorded on the Lessons page.
 */
export type LessonTone = {
    key: 'upcoming' | 'live' | 'awaiting' | 'attended' | 'absent' | 'cancelled' | 'other';
    label: string;
    icon: LucideIcon;
    /** Classes for the badge. */
    badge: string;
    /** Classes for the block on the week grid / the card in the agenda. */
    block: string;
    /** Past (or cancelled): visually quieter than what is still ahead. */
    muted: boolean;
};

const TONES: Record<Exclude<LessonTone['key'], 'other'>, Omit<LessonTone, 'key'>> = {
    upcoming: {
        label: 'Upcoming',
        icon: CalendarClock,
        badge: 'text-brand bg-brand-soft border-brand/25',
        block: 'border-brand/40 bg-brand-soft text-brand hover:bg-brand/15',
        muted: false,
    },
    live: {
        label: 'In progress',
        icon: PlayCircle,
        badge: 'text-white bg-brand border-brand',
        block: 'border-brand bg-brand text-white hover:bg-brand/90',
        muted: false,
    },
    awaiting: {
        label: 'Needs update',
        icon: CircleDashed,
        badge: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30',
        block: 'border-dashed border-amber-500/60 bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:bg-amber-500/15',
        muted: true,
    },
    attended: {
        label: 'Attended',
        icon: CheckCircle2,
        badge: 'text-teal-700 dark:text-teal-300 bg-teal-500/10 border-teal-500/25',
        block: 'border-teal-500/30 bg-teal-500/10 text-teal-800 dark:text-teal-200 hover:bg-teal-500/15',
        muted: true,
    },
    absent: {
        label: 'Absent',
        icon: UserX,
        badge: 'text-orange-700 dark:text-orange-300 bg-orange-500/10 border-orange-500/30',
        block: 'border-orange-500/30 bg-orange-500/10 text-orange-800 dark:text-orange-200 hover:bg-orange-500/15',
        muted: true,
    },
    cancelled: {
        label: 'Cancelled',
        icon: XCircle,
        badge: 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/25',
        block: 'border-rose-500/30 bg-rose-500/5 text-rose-700/80 dark:text-rose-300/80 line-through decoration-rose-500/50 hover:bg-rose-500/10',
        muted: true,
    },
};

export function lessonTone(lesson: { status: string; startsAt: string; endsAt: string }, now: number): LessonTone {
    switch (lesson.status) {
        case LESSON_STATUS.SCHEDULED: {
            const start = parseInstant(lesson.startsAt)?.getTime() ?? 0;
            const end = parseInstant(lesson.endsAt)?.getTime() ?? 0;
            const key = end <= now ? 'awaiting' : start <= now ? 'live' : 'upcoming';
            return { key, ...TONES[key] };
        }
        case LESSON_STATUS.ATTENDED:
            return { key: 'attended', ...TONES.attended };
        case LESSON_STATUS.ABSENT:
            return { key: 'absent', ...TONES.absent };
        case LESSON_STATUS.CANCELLED:
            return { key: 'cancelled', ...TONES.cancelled };
        default:
            // Older rows may carry other text; show it rather than hide the lesson.
            return {
                key: 'other',
                label: lesson.status ? lesson.status.charAt(0) + lesson.status.slice(1).toLowerCase() : 'Lesson',
                icon: Clock3,
                badge: 'text-muted-foreground bg-muted border-border',
                block: 'border-border bg-muted text-foreground hover:bg-muted/80',
                muted: true,
            };
    }
}

/** A lesson that can still be changed: scheduled, and not over yet... and not already started. */
export const isUpcomingScheduled = (lesson: { status: string; startsAt: string }, now: number) =>
    lesson.status === LESSON_STATUS.SCHEDULED && (parseInstant(lesson.startsAt)?.getTime() ?? 0) > now;

export const LessonStatusBadge = ({ lesson, now, className }: { lesson: { status: string; startsAt: string; endsAt: string }; now: number; className?: string }) => {
    const tone = lessonTone(lesson, now);
    return (
        <Badge variant="outline" className={cn('h-auto gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium', tone.badge, className)}>
            <tone.icon className="size-3" aria-hidden />
            {tone.label}
        </Badge>
    );
};

/* ───────────────────────────  Requests  ─────────────────────────── */

const REQUEST_STATUS: Record<LessonChangeStatus, { label: string; badge: string }> = {
    PENDING: { label: 'Pending', badge: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30' },
    APPROVED: { label: 'Approved', badge: 'text-teal-700 dark:text-teal-300 bg-teal-500/10 border-teal-500/25' },
    REJECTED: { label: 'Rejected', badge: 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/25' },
    CANCELLED: { label: 'Cancelled', badge: 'text-muted-foreground bg-muted border-border' },
};

export const REQUEST_STATUS_LABEL: Record<LessonChangeStatus, string> = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
};

export const RequestStatusBadge = ({ status, className }: { status: LessonChangeStatus; className?: string }) => (
    <Badge
        variant="outline"
        title={status === 'CANCELLED' ? 'Withdrawn by the family before it was answered' : undefined}
        className={cn('h-auto rounded-full px-2.5 py-0.5 text-[11px] font-medium', REQUEST_STATUS[status].badge, className)}
    >
        {REQUEST_STATUS[status].label}
    </Badge>
);

export const RequestTypeBadge = ({ type, className }: { type: LessonChangeType; className?: string }) => {
    const Icon = type === 'CANCEL' ? XCircle : CalendarClock;
    return (
        <Badge variant="outline" className={cn('h-auto gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-foreground/80', className)}>
            <Icon className="size-3" aria-hidden />
            {type === 'CANCEL' ? 'Cancel lesson' : 'Reschedule'}
        </Badge>
    );
};
