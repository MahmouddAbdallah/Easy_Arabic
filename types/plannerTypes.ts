/**
 * The shapes the planner API returns and the planner UI consumes. Every date is an ISO 8601 string in UTC
 * (the database's "2026-09-24 20:39:54+00" text is converted on the way out, because Safari cannot parse it).
 */
import type { REQUEST_STATUSES, REQUEST_TYPES } from '@/lib/planner/constants';

export type PlannerRole = 'admin' | 'teacher' | 'family';
export type LessonChangeType = (typeof REQUEST_TYPES)[number];
export type LessonChangeStatus = (typeof REQUEST_STATUSES)[number];

/** Whose planner is being shown. For a teacher or family this is always themselves. */
export type PlannerScope = { kind: 'teacher' | 'family'; id: string };

export type PlannerPerson = { id: string; name: string };

/** The open request on a lesson, if any (there can be at most one). */
export type PlannerPendingRequest = {
    id: string;
    type: LessonChangeType;
    requestedStartsAt: string | null;
    reason: string | null;
    createdAt: string;
};

export type PlannerLesson = {
    id: string;
    student: string;
    /** SCHEDULED | ATTENDED | ABSENT | CANCELLED (older rows may hold other text). */
    status: string;
    startsAt: string;
    /** startsAt + duration, computed on the server from `Lesson.duration`. */
    endsAt: string;
    duration: number;
    teacher: PlannerPerson;
    family: PlannerPerson;
    pendingRequest: PlannerPendingRequest | null;
};

/** Another lesson that overlaps a proposed time. Family-side conflicts never reveal who/what. */
export type PlannerConflict = {
    kind: 'teacher' | 'family';
    startsAt: string;
    endsAt: string;
    /** Only present for the teacher's own lessons. */
    student?: string;
    /** When scheduling several lessons at once: which requested start this conflict belongs to. */
    requestedStartsAt?: string;
};

export type PlannerRequest = {
    id: string;
    lessonId: string;
    type: LessonChangeType;
    status: LessonChangeStatus;
    reason: string | null;
    reviewerNote: string | null;
    /** The lesson's start when the request was made. */
    originalStartsAt: string;
    /** RESCHEDULE only. */
    requestedStartsAt: string | null;
    createdAt: string;
    reviewedAt: string | null;
    /** Who decided, as the viewer is allowed to know it. */
    reviewedBy: { role: 'teacher' | 'admin'; name: string | null } | null;
    teacher: PlannerPerson;
    family: PlannerPerson;
    /** The lesson as it is now (it may have moved since the request was made). */
    lesson: {
        id: string;
        student: string;
        status: string;
        startsAt: string;
        endsAt: string;
        duration: number;
    };
    /** Why this request can't be approved right now, if it can't (teacher/admin views only). */
    blocker: { code: string; message: string } | null;
    /** Pending reschedule whose target time collides with another lesson (teacher/admin views only). */
    conflict: PlannerConflict | null;
};

export type PlannerRequestList = {
    requests: PlannerRequest[];
    /** Rows matching the current status filter. */
    count: number;
    page: number;
    pageSize: number;
    /** Per-status totals for the tabs, always across all statuses. */
    totals: Record<LessonChangeStatus, number> & { all: number };
};

/** A family a teacher may schedule for, with the student names already used with them. */
export type PlannerFamilyOption = { id: string; name: string; students: string[] };

export type PlannerError = { code: string; message: string; conflicts?: PlannerConflict[] };
