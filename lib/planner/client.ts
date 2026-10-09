import axios from 'axios';
import type {
    LessonChangeStatus,
    PlannerConflict,
    PlannerFamilyOption,
    PlannerLesson,
    PlannerRequestList,
    PlannerScope,
} from '@/types/plannerTypes';

/**
 * The browser's side of the planner API. Pure transport: every rule (who may do what, what overlaps) is enforced
 * by the server, these helpers only shape the calls and turn failures into something a screen can show.
 *
 * `subject` is only meaningful for an ADMIN looking at someone else's planner (the dashboard pages). For teachers
 * and families the server ignores it, so the planner is always their own.
 */
export type PlannerSubject = { teacherId: string } | { familyId: string } | undefined;

/** A failed planner call, with the server's code/message and (for scheduling clashes) the clashes themselves. */
export class PlannerApiError extends Error {
    constructor(
        message: string,
        readonly code: string,
        readonly status: number,
        readonly conflicts: PlannerConflict[] = []
    ) {
        super(message);
        this.name = 'PlannerApiError';
    }
}

function toError(error: unknown): PlannerApiError {
    if (axios.isAxiosError(error)) {
        const e = error.response?.data?.error;
        if (e?.message) return new PlannerApiError(e.message, e.code ?? 'ERROR', error.response?.status ?? 0, e.conflicts ?? []);
        if (!error.response) return new PlannerApiError('Could not reach the server. Check your connection and try again.', 'NETWORK', 0);
    }
    return new PlannerApiError('Something went wrong. Please try again.', 'UNKNOWN', 0);
}

async function call<T>(promise: Promise<{ data: T }>): Promise<T> {
    try {
        return (await promise).data;
    } catch (error) {
        throw toError(error);
    }
}

const subjectParams = (subject: PlannerSubject) => (subject ?? {}) as Record<string, string>;

export const plannerApi = {
    lessons: (from: Date, to: Date, subject?: PlannerSubject, signal?: AbortSignal) =>
        call<{ success: true; scope: PlannerScope; lessons: PlannerLesson[] }>(
            axios.get('/api/planner/lessons', { params: { from: from.toISOString(), to: to.toISOString(), ...subjectParams(subject) }, signal })
        ),

    requests: (opts: { status?: LessonChangeStatus; page: number; pageSize?: number }, subject?: PlannerSubject, signal?: AbortSignal) =>
        call<{ success: true } & PlannerRequestList>(
            axios.get('/api/planner/requests', { params: { ...opts, ...subjectParams(subject) }, signal })
        ),

    families: () => call<{ success: true; families: PlannerFamilyOption[] }>(axios.get('/api/planner/families')),

    schedule: (body: { familyId: string; student: string; duration: number; startTimes: string[] }) =>
        call<{ success: true; message: string; lessons: PlannerLesson[] }>(axios.post('/api/planner/lessons', body)),

    changeLesson: (lessonId: string, body: { action: 'cancel' } | { action: 'reschedule'; startsAt: string }) =>
        call<{ success: true; message: string }>(axios.patch(`/api/planner/lessons/${lessonId}`, body)),

    submitRequest: (body: { lessonId: string; type: 'CANCEL' | 'RESCHEDULE'; requestedStartsAt?: string; reason?: string }) =>
        call<{ success: true; message: string }>(axios.post('/api/planner/requests', body)),

    withdrawRequest: (requestId: string) => call<{ success: true; message: string }>(axios.delete(`/api/planner/requests/${requestId}`)),

    decide: (requestId: string, body: { decision: 'approve' | 'reject'; note?: string }) =>
        call<{ success: true; message: string }>(axios.patch(`/api/planner/requests/${requestId}`, body)),
};
