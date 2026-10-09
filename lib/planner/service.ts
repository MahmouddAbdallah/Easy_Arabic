import 'server-only';
import { db } from '@/prisma/db';
import { isUniqueViolation } from '@/lib/apiResponse';
import { consume, rateLimitKey } from '@/lib/auth/rateLimit';
import type {
    LessonChangeStatus,
    PlannerConflict,
    PlannerFamilyOption,
    PlannerLesson,
    PlannerPendingRequest,
    PlannerRequest,
    PlannerRequestList,
    PlannerRole,
    PlannerScope,
} from '@/types/plannerTypes';
import { LESSON_STATUS, MAX_HORIZON_DAYS } from './constants';
import { addMinutes, lessonEnd, MS_DAY, MS_MINUTE, parseInstant, rangesOverlap } from './time';
import type { ChangeLessonInput, ScheduleLessonsInput, SubmitRequestInput } from './validation';

/**
 * ALL planner business rules live here, not in the routes or the UI (same layout as lib/profile/service.ts):
 *
 *   - the acting person is always the `Viewer` the route built from the verified session cookie. Ids that
 *     arrive in a body or a query string (a lesson, a family, a request) are only ever LOOKUPS: each one is
 *     checked against the database to belong to that viewer before anything is read or written;
 *   - a lesson's time is never edited in place by a family: it asks, and a teacher (or admin) decides;
 *   - every state change is a single compare-and-set statement, so two simultaneous clicks cannot both win;
 *   - anything that can make two lessons overlap runs inside a transaction that first takes an advisory lock
 *     on the teacher and on the family, then re-checks for conflicts.
 */

export type Viewer = { id: string; name: string; role: PlannerRole };

export type ServiceError = { ok: false; status: number; code: string; message: string; conflicts?: PlannerConflict[] };
export type ServiceResult<T> = { ok: true; data: T } | ServiceError;

const fail = (status: number, code: string, message: string, conflicts?: PlannerConflict[]): ServiceError => ({
    ok: false,
    status,
    code,
    message,
    ...(conflicts && { conflicts }),
});
const ok = <T,>(data: T): ServiceResult<T> => ({ ok: true, data });

/** Thrown inside a transaction to roll it back and hand a ready-made error to the caller. */
class Abort extends Error {
    constructor(readonly error: ServiceError) {
        super(error.code);
    }
}
const abort = (...args: Parameters<typeof fail>) => new Abort(fail(...args));

const TEXT = 'pg/text@1';
const INT = 'pg/int4@1';

type Runner = { query: (plan: any) => PromiseLike<any> };
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const defaultRunner: Runner = { query: (plan) => db.runtime().query(plan) };

/** Postgres timestamptz text -> ISO 8601 (Safari cannot parse the database's own format). */
const iso = (value: string | Date): string => parseInstant(value)?.toISOString() ?? String(value);

const SCHEDULE_RATE_FALLBACK = 50; // same default as the existing "log a lesson" route

/* ───────────────────────────────  Scope  ─────────────────────────────── */

/**
 * Whose planner is this call about? A teacher or family gets their own, whatever the query string says
 * (naming someone else is refused, not silently ignored). An admin must name exactly one teacher or family,
 * and that account must really exist with that role.
 */
export async function resolveScope(
    viewer: Viewer,
    params: { teacherId?: string; familyId?: string }
): Promise<ServiceResult<PlannerScope>> {
    if (viewer.role === 'teacher' || viewer.role === 'family') {
        const other = viewer.role === 'teacher' ? params.familyId : params.teacherId;
        const own = viewer.role === 'teacher' ? params.teacherId : params.familyId;
        if (other || (own && own !== viewer.id)) return fail(403, 'FORBIDDEN', 'You can only open your own planner.');
        return ok({ kind: viewer.role, id: viewer.id });
    }

    const named = Number(!!params.teacherId) + Number(!!params.familyId);
    if (named !== 1) return fail(400, 'SUBJECT_REQUIRED', 'Choose a teacher or a family.');
    const kind = params.teacherId ? 'teacher' : 'family';
    const id = (params.teacherId ?? params.familyId)!;
    const account = await db.orm.public.User.where({ id }).select('id', 'role').first();
    if (!account || account.role !== kind) return fail(404, 'NOT_FOUND', 'Not found.');
    return ok({ kind, id });
}

/* ───────────────────────────────  Reading lessons  ─────────────────────────────── */

type LessonRow = {
    id: string;
    student: string;
    status: string;
    classDate: string;
    duration: number;
    teacherId: string;
    familyId: string;
};

const toPending = (r: {
    id: string;
    type: string;
    requestedClassDate: string | null;
    reason: string | null;
    createdAt: string;
}): PlannerPendingRequest => ({
    id: r.id,
    type: r.type as PlannerPendingRequest['type'],
    requestedStartsAt: r.requestedClassDate ? iso(r.requestedClassDate) : null,
    reason: r.reason,
    createdAt: iso(r.createdAt),
});

const toLesson = (
    row: LessonRow & { teacher?: { id: string; name: string } | null; family?: { id: string; name: string } | null },
    pending: PlannerPendingRequest | null
): PlannerLesson => {
    const start = parseInstant(row.classDate) ?? new Date(NaN);
    return {
        id: row.id,
        student: row.student,
        status: row.status,
        startsAt: iso(row.classDate),
        endsAt: lessonEnd(start, row.duration).toISOString(),
        duration: row.duration,
        teacher: { id: row.teacherId, name: row.teacher?.name ?? 'Teacher' },
        family: { id: row.familyId, name: row.family?.name ?? 'Family' },
        pendingRequest: pending,
    };
};

/** Every lesson of `scope` that starts inside [from, to). */
export async function listLessons(scope: PlannerScope, fromIso: string, toIso: string): Promise<PlannerLesson[]> {
    const L = db.orm.public.Lesson;
    const owned = scope.kind === 'teacher' ? L.where((l) => l.teacherId.eq(scope.id)) : L.where((l) => l.familyId.eq(scope.id));

    const rows = (await owned
        .where((l) => l.classDate.gte(fromIso))
        .where((l) => l.classDate.lt(toIso))
        .select('id', 'student', 'status', 'classDate', 'duration', 'teacherId', 'familyId')
        .orderBy([(l) => l.classDate.asc(), (l) => l.id.asc()])
        .limit(500)
        .include('teacher', (t) => t.select('id', 'name'))
        .include('family', (f) => f.select('id', 'name'))
        .all()) as unknown as (LessonRow & { teacher: { id: string; name: string } | null; family: { id: string; name: string } | null })[];

    const ids = rows.map((r) => r.id);
    const pendingRows = ids.length
        ? await db.orm.public.LessonChangeRequest.where((r) => r.lessonId.in(ids))
            .where({ status: 'PENDING' })
            .select('id', 'lessonId', 'type', 'requestedClassDate', 'reason', 'createdAt')
            .all()
        : [];
    const pendingByLesson = new Map(pendingRows.map((p) => [p.lessonId, toPending(p)]));

    return rows.map((row) => toLesson(row, pendingByLesson.get(row.id) ?? null));
}

/** The families a teacher can schedule for (their assigned, active ones), with student names already used with each. */
export async function listTeacherFamilies(teacherId: string): Promise<PlannerFamilyOption[]> {
    const links = (await db.orm.public.TeacherFamily.where({ teacherId })
        .select('familyId')
        .include('family', (f) => f.select('id', 'name', 'status', 'role'))
        .all()) as unknown as { familyId: string; family: { id: string; name: string; status: string; role: string } | null }[];

    const families = links
        .map((l) => l.family)
        .filter((f): f is NonNullable<typeof f> => !!f && f.role === 'family' && f.status === 'active')
        .sort((a, b) => a.name.localeCompare(b.name));
    if (families.length === 0) return [];

    const plan = db.raw.sql`
        SELECT l."familyId" AS "familyId", l."student" AS "student"
        FROM "lesson" l
        WHERE l."teacherId" = ${teacherId}
        GROUP BY l."familyId", l."student"
        ORDER BY max(l."classDate") DESC
        LIMIT 500
    `.returnsRow({ familyId: TEXT, student: TEXT }).build();
    const used = (await db.runtime().query(plan)) as { familyId: string; student: string }[];

    const studentsByFamily = new Map<string, string[]>();
    for (const { familyId, student } of used) {
        const list = studentsByFamily.get(familyId) ?? [];
        if (student.trim() && list.length < 8) list.push(student);
        studentsByFamily.set(familyId, list);
    }
    return families.map((f) => ({ id: f.id, name: f.name, students: studentsByFamily.get(f.id) ?? [] }));
}

/* ───────────────────────────────  Conflicts & locks  ─────────────────────────────── */

/**
 * Two lessons conflict when they overlap in time and share the teacher OR the family. A CANCELLED lesson
 * frees its slot. `excludeLessonId` is the lesson being moved (it must not collide with itself).
 */
async function findConflicts(
    runner: Runner,
    p: { teacherId: string; familyId: string; start: Date; duration: number; excludeLessonId?: string }
): Promise<PlannerConflict[]> {
    const startIso = p.start.toISOString();
    const endIso = addMinutes(p.start, p.duration).toISOString();
    const plan = db.raw.sql`
        SELECT l."id" AS "id", l."classDate"::text AS "classDate", l."duration" AS "duration",
               l."student" AS "student", l."teacherId" AS "teacherId"
        FROM "lesson" l
        WHERE l."status" <> ${LESSON_STATUS.CANCELLED}
          AND (l."teacherId" = ${p.teacherId} OR l."familyId" = ${p.familyId})
          AND l."id" <> ${p.excludeLessonId ?? ''}
          AND l."classDate" < ${endIso}::timestamptz
          AND l."classDate" + make_interval(mins => l."duration") > ${startIso}::timestamptz
        ORDER BY l."classDate" ASC
        LIMIT 5
    `.returnsRow({ id: TEXT, classDate: TEXT, duration: INT, student: TEXT, teacherId: TEXT }).build();

    const rows = (await runner.query(plan)) as { id: string; classDate: string; duration: number; student: string; teacherId: string }[];
    return rows.map((r) => {
        const start = parseInstant(r.classDate) ?? p.start;
        const kind = r.teacherId === p.teacherId ? 'teacher' : 'family';
        return {
            kind,
            startsAt: start.toISOString(),
            endsAt: lessonEnd(start, r.duration).toISOString(),
            // A teacher may see their own lesson's student; nobody learns about the OTHER side's lessons.
            ...(kind === 'teacher' && { student: r.student }),
        };
    });
}

/**
 * Serialises everything that can create or move a lesson for this teacher or this family. Transaction-scoped
 * advisory locks: released at COMMIT/ROLLBACK. Keys are taken in sorted order, so two transactions touching
 * the same two parties can never deadlock each other.
 */
async function lockParties(tx: Tx, teacherId: string, familyId: string): Promise<void> {
    const keys = [`planner:teacher:${teacherId}`, `planner:family:${familyId}`].sort();
    for (const key of keys) {
        await tx.query(db.raw.sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text AS "locked"`.returnsRow({ locked: TEXT }).build());
    }
}

/* ───────────────────────────────  Time rules  ─────────────────────────────── */

/** Start times are whole minutes: the planner never stores sub-minute noise. */
const toMinute = (d: Date) => new Date(Math.floor(d.getTime() / MS_MINUTE) * MS_MINUTE);

/** Returns an error message if `start` is not a bookable future moment. */
function futureProblem(start: Date, now = Date.now()): string | null {
    if (start.getTime() <= now) return 'That time has already passed. Choose a time in the future.';
    if (start.getTime() > now + MAX_HORIZON_DAYS * MS_DAY) return 'That is too far ahead. Choose a date within the next year.';
    return null;
}

/**
 * What a lesson will earn, stamped when it is scheduled (same formula as the existing "log a lesson" route). It only counts
 * towards earnings once the lesson has actually happened: SCHEDULED lessons are excluded from the dashboard figures, and a
 * lesson cancelled before it happened is set back to 0 (see the two cancel statements below).
 */
const money = (rate: number | undefined, duration: number) => Math.round((rate ?? SCHEDULE_RATE_FALLBACK) * (duration / 60));

/* ───────────────────────────────  Teacher: schedule lessons  ─────────────────────────────── */

/**
 * A teacher schedules lessons for a family they are assigned to. All-or-nothing: if any one of the lessons would
 * overlap another lesson of the teacher or the family, nothing is created and every clash is reported.
 */
export async function scheduleLessons(teacher: Viewer, input: ScheduleLessonsInput): Promise<ServiceResult<{ lessons: PlannerLesson[] }>> {
    // 1. The family must be one of THIS teacher's (the client's familyId is only a lookup key).
    const link = await db.orm.public.TeacherFamily.where({ teacherId: teacher.id, familyId: input.familyId }).select('id').first();
    if (!link) return fail(403, 'NOT_ASSIGNED', 'You are not assigned to this family.');

    const family = await db.orm.public.User.where({ id: input.familyId }).select('id', 'name', 'role', 'status').first();
    if (!family || family.role !== 'family') return fail(404, 'FAMILY_NOT_FOUND', 'Family not found.');
    if (family.status !== 'active') return fail(409, 'FAMILY_INACTIVE', 'This family account is not active.');

    // 2. Normalise and check the requested times.
    const now = Date.now();
    const starts = [...new Map(input.startTimes.map((t) => [toMinute(new Date(t)).getTime(), toMinute(new Date(t))])).values()].sort(
        (a, b) => a.getTime() - b.getTime()
    );
    for (const start of starts) {
        const problem = futureProblem(start, now);
        if (problem) return fail(400, 'INVALID_TIME', problem);
    }
    for (let i = 1; i < starts.length; i++) {
        if (rangesOverlap(starts[i - 1], lessonEnd(starts[i - 1], input.duration), starts[i], lessonEnd(starts[i], input.duration))) {
            return fail(400, 'SELF_OVERLAP', 'Two of the lessons you chose overlap each other. Choose times at least one lesson length apart.');
        }
    }

    const rate = await db.orm.public.MoneyPerLesson.where({ teacherId: teacher.id }).select('money').first();

    // 3. Lock, re-check for clashes, insert. One transaction: all lessons or none.
    try {
        const created = await db.transaction(async (tx: Tx) => {
            await lockParties(tx, teacher.id, input.familyId);

            const conflicts: PlannerConflict[] = [];
            for (const start of starts) {
                const found = await findConflicts(tx, { teacherId: teacher.id, familyId: input.familyId, start, duration: input.duration });
                for (const c of found) conflicts.push({ ...c, requestedStartsAt: start.toISOString() });
            }
            if (conflicts.length > 0) {
                throw abort(409, 'SCHEDULE_CONFLICT', 'One or more lessons would overlap another lesson. Nothing was scheduled.', conflicts);
            }

            const rows: LessonRow[] = [];
            for (const start of starts) {
                const row = await tx.orm.public.Lesson.create({
                    teacherId: teacher.id,
                    familyId: input.familyId,
                    student: input.student,
                    status: LESSON_STATUS.SCHEDULED,
                    classDate: start.toISOString(),
                    duration: input.duration,
                    money: money(rate?.money, input.duration),
                });
                rows.push(row as unknown as LessonRow);
            }
            return rows;
        });

        return ok({
            lessons: created.map((row) => toLesson({ ...row, teacher: { id: teacher.id, name: teacher.name }, family: { id: family.id, name: family.name } }, null)),
        });
    } catch (error) {
        if (error instanceof Abort) return error.error;
        throw error;
    }
}

/* ───────────────────────────────  Teacher: change one of their own lessons  ─────────────────────────────── */

/** Compare-and-set: only a lesson that is still SCHEDULED, and still the teacher's, is touched. */
async function updateLessonCas(
    runner: Runner,
    args: { id: string; teacherId: string; change: { cancel: true } | { startsAt: string } }
): Promise<boolean> {
    const plan =
        'cancel' in args.change
            ? db.raw.sql`
                UPDATE "lesson" SET "status" = ${LESSON_STATUS.CANCELLED}, "money" = 0, "updatedAt" = now()
                WHERE "id" = ${args.id} AND "teacherId" = ${args.teacherId} AND "status" = ${LESSON_STATUS.SCHEDULED}
                RETURNING "id"
            `
            : db.raw.sql`
                UPDATE "lesson" SET "classDate" = ${args.change.startsAt}::timestamptz, "updatedAt" = now()
                WHERE "id" = ${args.id} AND "teacherId" = ${args.teacherId} AND "status" = ${LESSON_STATUS.SCHEDULED}
                RETURNING "id"
            `;
    const rows = (await runner.query(plan.returnsRow({ id: TEXT }).build())) as unknown[];
    return rows.length > 0;
}

/**
 * A teacher cancels or moves one of THEIR OWN upcoming scheduled lessons directly (no request needed).
 * Refused while the family has an open request on it: answer that request instead.
 */
export async function changeOwnLesson(
    teacher: Viewer,
    lessonId: string,
    input: ChangeLessonInput
): Promise<ServiceResult<{ lessonId: string; familyId: string; action: ChangeLessonInput['action']; startsAt?: string }>> {
    const lesson = await db.orm.public.Lesson.where({ id: lessonId }).first();
    // Someone else's lesson looks exactly like a missing one.
    if (!lesson || lesson.teacherId !== teacher.id) return fail(404, 'NOT_FOUND', 'Lesson not found.');

    const start = parseInstant(lesson.classDate);
    if (lesson.status !== LESSON_STATUS.SCHEDULED || !start || start.getTime() <= Date.now()) {
        return fail(409, 'NOT_CHANGEABLE', 'Only upcoming scheduled lessons can be changed here. Use the Lessons page for lessons that already happened.');
    }

    const open = await db.orm.public.LessonChangeRequest.where({ lessonId, status: 'PENDING' }).select('id').first();
    if (open) return fail(409, 'HAS_PENDING_REQUEST', 'The family has a pending request for this lesson. Approve or reject it first.');

    if (input.action === 'cancel') {
        const changed = await updateLessonCas(defaultRunner, { id: lessonId, teacherId: teacher.id, change: { cancel: true } });
        if (!changed) return fail(409, 'NOT_CHANGEABLE', 'This lesson was just changed. Refresh and try again.');
        return ok({ lessonId, familyId: lesson.familyId, action: 'cancel' });
    }

    const newStart = toMinute(new Date(input.startsAt));
    const problem = futureProblem(newStart);
    if (problem) return fail(400, 'INVALID_TIME', problem);
    if (newStart.getTime() === start.getTime()) return fail(400, 'SAME_TIME', 'The lesson already starts at that time.');

    try {
        await db.transaction(async (tx: Tx) => {
            await lockParties(tx, lesson.teacherId, lesson.familyId);
            const conflicts = await findConflicts(tx, {
                teacherId: lesson.teacherId,
                familyId: lesson.familyId,
                start: newStart,
                duration: lesson.duration,
                excludeLessonId: lessonId,
            });
            if (conflicts.length > 0) throw abort(409, 'SCHEDULE_CONFLICT', 'That time overlaps another lesson.', conflicts);
            const changed = await updateLessonCas(tx, { id: lessonId, teacherId: teacher.id, change: { startsAt: newStart.toISOString() } });
            if (!changed) throw abort(409, 'NOT_CHANGEABLE', 'This lesson was just changed. Refresh and try again.');
        });
    } catch (error) {
        if (error instanceof Abort) return error.error;
        throw error;
    }
    return ok({ lessonId, familyId: lesson.familyId, action: 'reschedule', startsAt: newStart.toISOString() });
}

/* ───────────────────────────────  Family: ask for a change  ─────────────────────────────── */

const SUBMIT_LIMIT = { limit: 10, windowSeconds: 60 * 60 };

type RequestRow = {
    id: string;
    lessonId: string;
    teacherId: string;
    familyId: string;
    type: string;
    status: string;
    originalClassDate: string;
    requestedClassDate: string | null;
    reason: string | null;
    reviewedById: string | null;
    reviewedAt: string | null;
    reviewerNote: string | null;
    createdAt: string;
};

/** The family asks. Nothing about the lesson changes until the teacher (or an admin) approves. */
export async function submitRequest(
    family: Viewer,
    input: SubmitRequestInput
): Promise<ServiceResult<{ request: PlannerPendingRequest & { lessonId: string }; teacherId: string; student: string }>> {
    const lesson = await db.orm.public.Lesson.where({ id: input.lessonId }).first();
    // A lesson that isn't this family's looks exactly like a missing one.
    if (!lesson || lesson.familyId !== family.id) return fail(404, 'NOT_FOUND', 'Lesson not found.');

    const start = parseInstant(lesson.classDate);
    if (lesson.status !== LESSON_STATUS.SCHEDULED || !start) {
        return fail(409, 'NOT_CHANGEABLE', 'Only upcoming scheduled lessons can be changed.');
    }
    if (start.getTime() <= Date.now()) return fail(409, 'LESSON_STARTED', 'This lesson has already started, so it can no longer be changed.');

    let requested: Date | null = null;
    if (input.type === 'RESCHEDULE') {
        requested = toMinute(new Date(input.requestedStartsAt!));
        const problem = futureProblem(requested);
        if (problem) return fail(400, 'INVALID_TIME', problem);
        if (requested.getTime() === start.getTime()) return fail(400, 'SAME_TIME', 'The lesson already starts at that time.');
    }

    const open = await db.orm.public.LessonChangeRequest.where({ lessonId: lesson.id, status: 'PENDING' }).select('id').first();
    if (open) return fail(409, 'REQUEST_ALREADY_PENDING', 'This lesson already has a request waiting for your teacher. Wait for the answer, or withdraw it first.');

    const limited = await consume(rateLimitKey('lesson-request:user', family.id), SUBMIT_LIMIT);
    if (!limited.allowed) return fail(429, 'TOO_MANY_REQUESTS', 'You have sent several requests recently. Please try again later.');

    try {
        const row = (await db.orm.public.LessonChangeRequest.create({
            lessonId: lesson.id,
            // Snapshots of who the lesson belonged to (re-checked on approval) and when it started.
            teacherId: lesson.teacherId,
            familyId: family.id,
            type: input.type,
            originalClassDate: lesson.classDate,
            ...(requested && { requestedClassDate: requested.toISOString() }),
            reason: input.reason ?? null,
        })) as unknown as RequestRow;
        return ok({ request: { ...toPending(row), lessonId: lesson.id }, teacherId: lesson.teacherId, student: lesson.student });
    } catch (error) {
        // Two simultaneous submissions: the partial unique index lets exactly one in.
        if (isUniqueViolation(error)) return fail(409, 'REQUEST_ALREADY_PENDING', 'This lesson already has a request waiting for your teacher.');
        throw error;
    }
}

/** The family withdraws their own pending request. Someone else's id behaves exactly like a missing one. */
export async function withdrawRequest(family: Viewer, requestId: string): Promise<ServiceResult<{ teacherId: string }>> {
    const plan = db.raw.sql`
        UPDATE "lessonChangeRequest"
        SET "status" = 'CANCELLED', "updatedAt" = now()
        WHERE "id" = ${requestId} AND "familyId" = ${family.id} AND "status" = 'PENDING'
        RETURNING "teacherId" AS "teacherId"
    `.returnsRow({ teacherId: TEXT }).build();
    const rows = (await db.runtime().query(plan)) as { teacherId: string }[];
    if (rows.length > 0) return ok({ teacherId: rows[0].teacherId });

    const exists = await db.orm.public.LessonChangeRequest.where({ id: requestId, familyId: family.id }).select('id').first();
    if (!exists) return fail(404, 'NOT_FOUND', 'Request not found.');
    return fail(409, 'NOT_PENDING', 'This request has already been answered, so it can no longer be withdrawn.');
}

/* ───────────────────────────────  Listing requests  ─────────────────────────────── */

type RequestListRow = RequestRow & {
    lesson: LessonRow | null;
    teacher: { id: string; name: string } | null;
    family: { id: string; name: string } | null;
    reviewer: { id: string; name: string } | null;
};

/**
 * Why a PENDING request can't be approved right now, or null when it can. Used both to tell the teacher up
 * front (the list greys out "Approve") and as the real gate when they press it, so the two never disagree.
 */
function approvalBlocker(
    request: Pick<RequestRow, 'teacherId' | 'familyId' | 'type' | 'originalClassDate' | 'requestedClassDate'>,
    lesson: Pick<LessonRow, 'teacherId' | 'familyId' | 'status' | 'classDate'> | null,
    now = Date.now()
): { code: string; message: string } | null {
    if (!lesson) return { code: 'LESSON_NOT_FOUND', message: 'This lesson no longer exists.' };
    if (lesson.teacherId !== request.teacherId || lesson.familyId !== request.familyId) {
        return { code: 'LESSON_CHANGED', message: 'This lesson was reassigned after the request was sent. Reject it and ask the family to send a new one.' };
    }
    const start = parseInstant(lesson.classDate);
    const original = parseInstant(request.originalClassDate);
    if (!start || !original || start.getTime() !== original.getTime()) {
        return { code: 'LESSON_CHANGED', message: 'This lesson was changed after the request was sent. Reject it and ask the family to send a new one.' };
    }
    if (lesson.status !== LESSON_STATUS.SCHEDULED) {
        return { code: 'LESSON_NOT_SCHEDULED', message: 'This lesson is no longer scheduled, so there is nothing left to change.' };
    }
    if (start.getTime() <= now) return { code: 'LESSON_STARTED', message: 'This lesson has already started, so the request can only be rejected.' };
    if (request.type === 'RESCHEDULE') {
        const target = parseInstant(request.requestedClassDate);
        if (!target) return { code: 'INVALID_REQUEST_DATA', message: 'This request has no valid new time. Reject it.' };
        const problem = futureProblem(target, now);
        if (problem) return { code: 'REQUESTED_TIME_PASSED', message: problem };
    }
    return null;
}

/**
 * Requests for one planner, newest first. The teacher's view is "requests about MY lessons", the family's is
 * "MY requests", the admin's is whichever teacher/family they opened. Counts for the status tabs ignore the filter.
 */
export async function listRequests(
    viewer: Viewer,
    scope: PlannerScope,
    opts: { status?: LessonChangeStatus; page: number; pageSize: number }
): Promise<PlannerRequestList> {
    const R = db.orm.public.LessonChangeRequest;
    const base = scope.kind === 'teacher' ? R.where({ teacherId: scope.id }) : R.where({ familyId: scope.id });
    const filtered = opts.status ? base.where({ status: opts.status }) : base;

    const [count, groups, rows] = await Promise.all([
        filtered.aggregate((a) => ({ count: a.count() })),
        base.groupBy('status').aggregate((a) => ({ count: a.count() })),
        filtered
            .orderBy([(r) => r.createdAt.desc(), (r) => r.id.asc()])
            .offset((opts.page - 1) * opts.pageSize)
            .limit(opts.pageSize)
            .include('lesson', (l) => l.select('id', 'student', 'status', 'classDate', 'duration', 'teacherId', 'familyId'))
            .include('teacher', (t) => t.select('id', 'name'))
            .include('family', (f) => f.select('id', 'name'))
            .include('reviewer', (u) => u.select('id', 'name'))
            .all(),
    ]);

    const totals = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0, all: 0 };
    for (const g of groups) {
        totals[g.status as LessonChangeStatus] = g.count;
        totals.all += g.count;
    }

    // Teacher / admin see whether each open request can be approved; a family never sees the teacher's calendar.
    const staff = viewer.role !== 'family';
    const now = Date.now();

    const requests = await Promise.all(
        (rows as unknown as RequestListRow[]).map(async (row): Promise<PlannerRequest> => {
            const lesson = row.lesson;
            const start = parseInstant(lesson?.classDate ?? row.originalClassDate) ?? new Date(NaN);
            const duration = lesson?.duration ?? 0;

            let blocker: PlannerRequest['blocker'] = null;
            let conflict: PlannerRequest['conflict'] = null;
            if (staff && row.status === 'PENDING') {
                blocker = approvalBlocker(row, lesson, now);
                const target = parseInstant(row.requestedClassDate);
                if (!blocker && row.type === 'RESCHEDULE' && lesson && target) {
                    [conflict = null] = await findConflicts(defaultRunner, {
                        teacherId: row.teacherId,
                        familyId: row.familyId,
                        start: target,
                        duration: lesson.duration,
                        excludeLessonId: lesson.id,
                    });
                }
            }

            const reviewedBy: PlannerRequest['reviewedBy'] = row.reviewedAt
                ? {
                    role: row.reviewedById === row.teacherId ? 'teacher' : 'admin',
                    // A family is told who decided (their teacher, or "the admin") but not which admin.
                    name: staff ? (row.reviewer?.name ?? null) : null,
                }
                : null;

            return {
                id: row.id,
                lessonId: row.lessonId,
                type: row.type as PlannerRequest['type'],
                status: row.status as LessonChangeStatus,
                reason: row.reason,
                reviewerNote: row.reviewerNote,
                originalStartsAt: iso(row.originalClassDate),
                requestedStartsAt: row.requestedClassDate ? iso(row.requestedClassDate) : null,
                createdAt: iso(row.createdAt),
                reviewedAt: row.reviewedAt ? iso(row.reviewedAt) : null,
                reviewedBy,
                teacher: { id: row.teacherId, name: row.teacher?.name ?? 'Teacher' },
                family: { id: row.familyId, name: row.family?.name ?? 'Family' },
                lesson: {
                    id: row.lessonId,
                    student: lesson?.student ?? '',
                    status: lesson?.status ?? 'DELETED',
                    startsAt: Number.isNaN(start.getTime()) ? iso(row.originalClassDate) : start.toISOString(),
                    endsAt: Number.isNaN(start.getTime()) ? iso(row.originalClassDate) : lessonEnd(start, duration).toISOString(),
                    duration,
                },
                blocker,
                conflict,
            };
        })
    );

    return { requests, count: count.count, page: opts.page, pageSize: opts.pageSize, totals };
}

/* ───────────────────────────────  Teacher / admin: decide  ─────────────────────────────── */

/** PENDING -> APPROVED/REJECTED in ONE statement; true only for the single call that really changed the row. */
async function decidePending(
    runner: Runner,
    args: { id: string; to: 'APPROVED' | 'REJECTED'; reviewerId: string; note: string | null; onlyTeacherId: string }
): Promise<boolean> {
    const plan = db.raw.sql`
        UPDATE "lessonChangeRequest"
        SET "status" = ${args.to}, "reviewedById" = ${args.reviewerId}, "reviewedAt" = now(),
            "reviewerNote" = NULLIF(${args.note ?? ''}, ''), "updatedAt" = now()
        WHERE "id" = ${args.id} AND "status" = 'PENDING'
          AND (${args.onlyTeacherId} = '' OR "teacherId" = ${args.onlyTeacherId})
        RETURNING "id"
    `.returnsRow({ id: TEXT }).build();
    return ((await runner.query(plan)) as unknown[]).length > 0;
}

export type DecisionOutcome = {
    status: 'APPROVED' | 'REJECTED';
    type: PlannerRequest['type'];
    lessonId: string;
    teacherId: string;
    familyId: string;
    student: string;
    /** For an approved reschedule, the lesson's new start. */
    newStartsAt: string | null;
};

/**
 * A teacher (only for their own lessons) or an admin approves or rejects a pending request.
 *
 * Approval is one transaction: lock the teacher and the family, re-read the request and the lesson, re-validate
 * everything (including "does the new time collide with anything?"), claim the request (PENDING -> APPROVED),
 * then change the lesson. If anything fails the whole thing rolls back and the request stays PENDING.
 */
export async function decideRequest(
    actor: Viewer,
    requestId: string,
    review: { decision: 'approve' | 'reject'; note?: string }
): Promise<ServiceResult<DecisionOutcome>> {
    if (actor.role === 'family') return fail(403, 'FORBIDDEN', 'Forbidden');
    // '' means "no restriction" (admin); a teacher is pinned to their own id inside every statement below.
    const onlyTeacherId = actor.role === 'teacher' ? actor.id : '';

    const request = (await db.orm.public.LessonChangeRequest.where({ id: requestId }).first()) as unknown as RequestRow | null;
    // Someone else's request looks exactly like a missing one.
    if (!request || (actor.role === 'teacher' && request.teacherId !== actor.id)) return fail(404, 'NOT_FOUND', 'Request not found.');
    if (request.status !== 'PENDING') return fail(409, 'ALREADY_REVIEWED', 'This request has already been answered.');

    const note = review.note ?? null;
    const lessonForOutcome = await db.orm.public.Lesson.where({ id: request.lessonId }).select('student').first();
    const base = {
        type: request.type as PlannerRequest['type'],
        lessonId: request.lessonId,
        teacherId: request.teacherId,
        familyId: request.familyId,
        student: lessonForOutcome?.student ?? '',
    };

    if (review.decision === 'reject') {
        const claimed = await decidePending(defaultRunner, { id: requestId, to: 'REJECTED', reviewerId: actor.id, note, onlyTeacherId });
        if (!claimed) return fail(409, 'ALREADY_REVIEWED', 'This request has already been answered.');
        return ok({ ...base, status: 'REJECTED', newStartsAt: null });
    }

    try {
        const newStartsAt = await db.transaction(async (tx: Tx) => {
            await lockParties(tx, request.teacherId, request.familyId);

            // Re-read under the lock: what we validate is what we change.
            const fresh = (await tx.orm.public.LessonChangeRequest.where({ id: requestId }).first()) as unknown as RequestRow | null;
            if (!fresh || fresh.status !== 'PENDING') throw abort(409, 'ALREADY_REVIEWED', 'This request has already been answered.');
            const lesson = (await tx.orm.public.Lesson.where({ id: fresh.lessonId }).first()) as unknown as LessonRow | null;

            const blocker = approvalBlocker(fresh, lesson);
            if (blocker) throw abort(409, blocker.code, blocker.message);

            let target: string | null = null;
            if (fresh.type === 'RESCHEDULE') {
                const when = parseInstant(fresh.requestedClassDate)!;
                const conflicts = await findConflicts(tx, {
                    teacherId: fresh.teacherId,
                    familyId: fresh.familyId,
                    start: when,
                    duration: lesson!.duration,
                    excludeLessonId: lesson!.id,
                });
                if (conflicts.length > 0) {
                    throw abort(409, 'SCHEDULE_CONFLICT', 'The requested time overlaps another lesson, so it can\'t be approved.', conflicts);
                }
                target = when.toISOString();
            }

            const claimed = await decidePending(tx, { id: requestId, to: 'APPROVED', reviewerId: actor.id, note, onlyTeacherId });
            if (!claimed) throw abort(409, 'ALREADY_REVIEWED', 'This request has already been answered.');

            // The lesson must still be exactly the one the family asked about (same start, still SCHEDULED).
            const update =
                fresh.type === 'CANCEL'
                    ? db.raw.sql`
                        UPDATE "lesson" SET "status" = ${LESSON_STATUS.CANCELLED}, "money" = 0, "updatedAt" = now()
                        WHERE "id" = ${fresh.lessonId} AND "status" = ${LESSON_STATUS.SCHEDULED}
                          AND "classDate" = (SELECT "originalClassDate" FROM "lessonChangeRequest" WHERE "id" = ${requestId})
                        RETURNING "id"
                    `
                    : db.raw.sql`
                        UPDATE "lesson"
                        SET "classDate" = (SELECT "requestedClassDate" FROM "lessonChangeRequest" WHERE "id" = ${requestId}), "updatedAt" = now()
                        WHERE "id" = ${fresh.lessonId} AND "status" = ${LESSON_STATUS.SCHEDULED}
                          AND "classDate" = (SELECT "originalClassDate" FROM "lessonChangeRequest" WHERE "id" = ${requestId})
                        RETURNING "id"
                    `;
            const changed = (await tx.query(update.returnsRow({ id: TEXT }).build())) as unknown[];
            if (changed.length === 0) {
                throw abort(409, 'LESSON_CHANGED', 'This lesson was changed while you were approving. Refresh and try again.');
            }
            return target;
        });
        return ok({ ...base, status: 'APPROVED', newStartsAt });
    } catch (error) {
        if (error instanceof Abort) return error.error;
        throw error;
    }
}

/* ───────────────────────────────  Helpers for notifications  ─────────────────────────────── */

/** Requests waiting for an answer in one planner (the number on the dashboard's Planner tab). Never throws: a badge must not break a page. */
export async function countPendingRequests(scope: PlannerScope): Promise<number> {
    try {
        const R = db.orm.public.LessonChangeRequest;
        const base = scope.kind === 'teacher' ? R.where({ teacherId: scope.id }) : R.where({ familyId: scope.id });
        const { count } = await base.where({ status: 'PENDING' }).aggregate((a) => ({ count: a.count() }));
        return count;
    } catch (error) {
        console.error('[planner] could not count pending requests:', error);
        return 0;
    }
}

export async function getUserName(id: string): Promise<string | null> {
    const user = await db.orm.public.User.where({ id }).select('name').first();
    return user?.name ?? null;
}
