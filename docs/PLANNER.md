# Teacher & Family Planner

A shared weekly planner between teachers and families, built on the existing `Lesson` table.

| Who | Where | What they can do |
| --- | --- | --- |
| Teacher | `/planner` | See their lessons, **schedule** lessons (one-off or weekly), move/cancel their own upcoming lessons, **approve / reject** family requests |
| Family | `/planner` | See their lessons, **request** a cancellation or a new time, withdraw a pending request. A family never edits a lesson. |
| Admin | `/dashboard/teachers/[teacherId]/planner`, `/dashboard/families/[familyId]/planner` | See everything for that teacher / family, **approve / reject** requests. Admins have no planner of their own (`/planner` sends them to `/dashboard`). |

Code lives in `lib/planner/` (rules), `app/api/planner/` (routes), `components/planner/` (UI).
The service layer is modelled on `lib/profile/` (see `docs/PROFILE.md`).

## Data model

* **`Lesson`** is reused as is. The only new thing is a status value, `SCHEDULED` (planned, not yet happened).
  `status` is a free string, so no migration was needed for it. Existing values (`ATTENDED`, `ABSENT`, `CANCELLED`) are untouched.
  Money is stamped when a lesson is scheduled with the same formula as the existing "log a lesson" route.
* **`LessonChangeRequest`** (new, `prisma/contract.prisma`): `lessonId`, `teacherId`/`familyId` (snapshot at submission; the family is the requester),
  `type` (`CANCEL` | `RESCHEDULE`), `status` (`PENDING` | `APPROVED` | `REJECTED` | `CANCELLED` = withdrawn),
  `originalClassDate`, `requestedClassDate`, `reason`, `reviewedById`/`reviewedAt`/`reviewerNote`, timestamps.
  * A partial unique index allows **at most one `PENDING` request per lesson** (enforced by the database, so two simultaneous submissions cannot both win).
  * A `CHECK` requires a target time for `RESCHEDULE` and forbids one for `CANCEL`.
  * Deleting a lesson cascades to its requests.
* Applied with the repo's `db update` workflow: `migrations/app/refs/db.json` is advanced and the new snapshot is committed.

## Rules (all in `lib/planner/service.ts`)

* **Identity comes from the session cookie only.** Ids in a body/query (lesson, family, request) are lookups, each verified against the database to belong to the caller.
  Someone else's lesson/request answers `404`, exactly like a missing one.
* **Strict bodies** (`lib/planner/validation.ts`): an unknown field (`teacherId`, `status`, `money`, `reviewedById` ...) is a `400`.
* **Conflicts**: two lessons conflict when their time ranges overlap (touching ends are fine) and they share the **teacher or the family**.
  `CANCELLED` lessons free their slot. Everything that can create or move a lesson takes a transaction-scoped advisory lock on the teacher and the family, then re-checks.
  Scheduling a batch is **all-or-nothing** and reports every clash. Approving a reschedule re-checks for conflicts at approval time.
  Family-side clashes never reveal the other teacher's lesson (no student/teacher name).
* **Requests never change a lesson until approved.** Approval is one transaction: lock, re-read, re-validate, claim the request (`PENDING -> APPROVED`), then change the lesson.
  If anything fails it all rolls back and the request stays `PENDING`.
  A request can't be approved when the lesson moved, was reassigned, is no longer `SCHEDULED`, has already started, or (reschedule) the target time has passed.
  The list tells the teacher this up front and greys out Approve.
* **Cancelling a planned lesson** (teacher directly, or an approved cancellation) sets `status = CANCELLED` and `money = 0`.
  Rescheduling updates `classDate`.
* A teacher can't move/cancel directly a lesson that has a pending family request (answer the request first).
* Family requests are rate limited (10 / hour / family).
* Notifications (`type: 'lesson'`) go to the other party on: lessons scheduled, lesson moved/cancelled, request sent / withdrawn / answered. Text is generic (no times, names or reasons).

## API

All JSON, all under `/api/planner`. Mutating calls also require a same-origin request.

| Method & path | Roles | Purpose |
| --- | --- | --- |
| `GET /lessons?from&to[&teacherId\|familyId]` | all | Lessons of one planner in a window (max 42 days). Admin must name exactly one subject; others get their own and are refused (`403`) if they name someone else. |
| `POST /lessons` | teacher | Schedule `{ familyId, student, duration, startTimes[] }` for an assigned, active family |
| `PATCH /lessons/[lessonId]` | teacher | `{ action: 'cancel' }` or `{ action: 'reschedule', startsAt }` on their own upcoming lesson |
| `GET /requests?status&page&pageSize[&teacherId\|familyId]` | all | Requests (teacher: about their lessons; family: their own) with per-status totals |
| `POST /requests` | family | `{ lessonId, type, requestedStartsAt?, reason? }` |
| `PATCH /requests/[requestId]` | teacher, admin | `{ decision: 'approve' \| 'reject', note? }` (a teacher only for their own lessons) |
| `DELETE /requests/[requestId]` | family | Withdraw their own pending request |
| `GET /families` | teacher | Their assigned active families + student names used before |

Errors use the project's shape: `{ success: false, error: { code, message, conflicts? } }`.

## UI notes

* Times are stored/sent as UTC instants and displayed in the **viewer's** time zone. Time-dependent UI is rendered after mount (never from the server's clock).
* Lessons logged with the older form have a date but no time (saved at local midnight). They appear in a **"No time set"** lane above the grid instead of at 12 AM.
* The week grid is for `md` and up; phones get an agenda list of the same week.
* Built only from the project's shadcn/ui components (Calendar, Dialog, Sheet, AlertDialog, Popover, Select, Tabs, Badge, Card ...). No calendar dependency.

## Changes to existing behaviour (deliberate, small)

* `lib/data/home-data.ts`: `SCHEDULED` lessons are excluded from "recent lessons", "this month" counts/money/minutes and the attendance rate (they haven't happened);
  a family's "next lesson" now skips `CANCELLED` lessons.
* Lesson list/filter/edit form know the `Scheduled` status; editing only the date of a planner lesson keeps its time of day.
* `app/api/teacher/[teacherId]/lesson/[lessonId]` (PATCH/DELETE): a **teacher** can now only touch their own lessons (admins unchanged). Previously any teacher could edit/delete any lesson by id.
* Navigation: `Planner` in the main nav (teachers/families) and as a tab on the dashboard teacher/family pages (badge = pending requests).

## Tests

* `node --test lib/planner/time.test.ts`: the pure time/layout logic (overlap, weeks, weekly repeat across DST, overlapping-block layout).
* The API rules were exercised end to end against a real Postgres (ownership, conflicts, races, rollbacks, rate limit, stale requests), as were the pages for every role.
