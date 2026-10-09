/**
 * Shared by the server (validation, services) and the browser (forms, grid). No imports on purpose,
 * so it is safe in both worlds and trivially testable.
 */

/** `Lesson.status` values. Older forms only ever wrote the last three; SCHEDULED is the planner's. */
export const LESSON_STATUS = {
    SCHEDULED: 'SCHEDULED',
    ATTENDED: 'ATTENDED',
    ABSENT: 'ABSENT',
    CANCELLED: 'CANCELLED',
} as const;
export type LessonStatusValue = (typeof LESSON_STATUS)[keyof typeof LESSON_STATUS];

/** Minutes a lesson can last, the same set the existing lesson form offers (see the `Lesson.duration` comment). */
export const LESSON_DURATIONS = [15, 30, 45, 60, 75, 90, 120] as const;

export const REQUEST_TYPES = ['CANCEL', 'RESCHEDULE'] as const;
export const REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;

/** Most lessons one "schedule" action may create (e.g. 3 a week for 12 weeks = 36). */
export const MAX_OCCURRENCES = 52;
/** Nothing can be scheduled (or requested) further ahead than this. */
export const MAX_HORIZON_DAYS = 366;
/** The widest window `GET /api/planner/lessons` serves in one call (a month view with spill-over). */
export const MAX_RANGE_DAYS = 42;
/** Free-text notes (a family's reason, a reviewer's note). */
export const MAX_NOTE_LENGTH = 500;
export const MAX_STUDENT_LENGTH = 100;

/** Requests per page in the requests list. */
export const REQUESTS_PAGE_SIZE = 10;

/** Statuses that occupy the calendar. A CANCELLED lesson frees its slot. */
export const FREES_SLOT_STATUS = LESSON_STATUS.CANCELLED;
