import { z } from 'zod';
import {
    LESSON_DURATIONS,
    MAX_NOTE_LENGTH,
    MAX_OCCURRENCES,
    MAX_RANGE_DAYS,
    MAX_STUDENT_LENGTH,
    REQUEST_STATUSES,
    REQUEST_TYPES,
    REQUESTS_PAGE_SIZE,
} from './constants';
import { MS_DAY } from './time';

/**
 * Same philosophy as lib/profile/validation.ts: every BODY schema is strict (`z.strictObject`), so a client
 * that also sends `teacherId`, `status`, `money`, `reviewedById` ... gets a 400 instead of those fields being
 * silently ignored (or, worse, one day honoured). Query strings are lenient: they only ever select data.
 *
 * Nothing here decides who may do what. These schemas only say what a well-formed request looks like;
 * ownership is checked against the database in service.ts.
 */

/** A record id. Loose on purpose (older rows may not be UUIDs); it is only ever used as a bound query parameter. */
const idSchema = z
    .string('An id is required')
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,64}$/, 'Invalid id');

/** For `[lessonId]` / `[requestId]` URL segments: a malformed one is simply "not found". */
export const isValidId = (value: string): boolean => idSchema.safeParse(value).success;

/** An ISO-8601 instant, e.g. 2026-10-11T15:00:00.000Z (what `Date#toISOString` produces). */
const instantSchema = z.iso.datetime({ offset: true, message: 'Enter a valid date and time' });

const noteSchema = (label: string) =>
    z
        .string(`${label} must be text`)
        .trim()
        .max(MAX_NOTE_LENGTH, `${label} is too long (maximum ${MAX_NOTE_LENGTH} characters)`)
        .optional()
        .transform((v) => (v ? v : undefined));

const durationSchema = z
    .number('Choose a duration')
    .int('Choose a duration')
    .refine((v) => (LESSON_DURATIONS as readonly number[]).includes(v), 'Choose one of the available durations');

const studentSchema = z
    .string('Student name is required')
    .trim()
    .min(1, 'Student name is required')
    .max(MAX_STUDENT_LENGTH, 'Student name is too long')
    .refine((v) => !/[\r\n\t]/.test(v), 'Student name must be a single line');

/** POST /api/planner/lessons - a teacher schedules one or more future lessons for one of their families. */
export const scheduleLessonsSchema = z.strictObject({
    familyId: idSchema,
    student: studentSchema,
    duration: durationSchema,
    // One ISO instant per lesson. The browser expands "every Sunday / Tuesday / Thursday for 8 weeks" into this
    // list in the teacher's own time zone; the server checks each entry on its own (future, no overlaps).
    startTimes: z
        .array(instantSchema, 'Choose when the lesson starts')
        .min(1, 'Choose when the lesson starts')
        .max(MAX_OCCURRENCES, `You can schedule at most ${MAX_OCCURRENCES} lessons at once`),
});
export type ScheduleLessonsInput = z.infer<typeof scheduleLessonsSchema>;

/** PATCH /api/planner/lessons/[lessonId] - a teacher moves or cancels one of their own upcoming lessons. */
export const changeLessonSchema = z.discriminatedUnion('action', [
    z.strictObject({ action: z.literal('reschedule'), startsAt: instantSchema }),
    z.strictObject({ action: z.literal('cancel') }),
]);
export type ChangeLessonInput = z.infer<typeof changeLessonSchema>;

/** POST /api/planner/requests - a family asks its teacher to cancel or move a lesson. */
export const submitRequestSchema = z
    .strictObject({
        lessonId: idSchema,
        type: z.enum(REQUEST_TYPES, 'Choose what you want to do'),
        requestedStartsAt: instantSchema.optional(),
        reason: noteSchema('Reason'),
    })
    .superRefine((v, ctx) => {
        if (v.type === 'RESCHEDULE' && !v.requestedStartsAt) {
            ctx.addIssue({ code: 'custom', path: ['requestedStartsAt'], message: 'Choose the new date and time' });
        }
        if (v.type === 'CANCEL' && v.requestedStartsAt) {
            ctx.addIssue({ code: 'custom', path: ['requestedStartsAt'], message: 'A cancellation has no new time' });
        }
    });
export type SubmitRequestInput = z.infer<typeof submitRequestSchema>;

/** PATCH /api/planner/requests/[requestId] - the teacher (or an admin) decides. The note is optional. */
export const reviewRequestSchema = z.strictObject({
    decision: z.enum(['approve', 'reject'], 'Decision must be "approve" or "reject"'),
    note: noteSchema('Note'),
});
export type ReviewRequestInput = z.infer<typeof reviewRequestSchema>;

/* ─────────────────────────────  Query strings  ───────────────────────────── */

/** `?teacherId=` / `?familyId=` select whose planner an ADMIN looks at. Ignored for everyone else's own planner (and refused if it is someone else's). */
const subjectParams = {
    teacherId: idSchema.optional(),
    familyId: idSchema.optional(),
};

/** GET /api/planner/lessons?from=&to= */
export const lessonsQuerySchema = z
    .object({ from: instantSchema, to: instantSchema, ...subjectParams })
    .superRefine((v, ctx) => {
        const from = Date.parse(v.from);
        const to = Date.parse(v.to);
        if (!(to > from)) ctx.addIssue({ code: 'custom', path: ['to'], message: '"to" must be after "from"' });
        else if (to - from > MAX_RANGE_DAYS * MS_DAY) {
            ctx.addIssue({ code: 'custom', path: ['to'], message: `Ask for at most ${MAX_RANGE_DAYS} days at a time` });
        }
    });

/** GET /api/planner/requests?status=&page= */
export const requestsQuerySchema = z.object({
    status: z.enum(REQUEST_STATUSES).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(REQUESTS_PAGE_SIZE),
    ...subjectParams,
});
