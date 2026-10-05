# Customer Profile & profile change requests

Customer-facing **Profile / Settings** page (`/profile`, `family` role only) and the admin queue that
reviews change requests (`/dashboard/profile-requests`). All rules live in `lib/profile/`; the routes
and pages are thin.

## Who can change what

| Field | Customer, unlocked | Customer, locked | Admin |
|---|---|---|---|
| `name`, `subject` | edit directly | request, admin approves | edit / approve |
| `email`, `phone` | **request only** (always admin-controlled) | request only | edit / approve |
| `role`, `status`, `password`, ids, tokens | never | never | existing admin flows only |
| password | existing *Change password* flow, always | same | n/a |

A profile is **locked** when EITHER the family has at least one `TeacherFamily` row OR the account is
`PROFILE_LOCK_MONTHS` (6) calendar months old or older. It is computed from the database on every
call (no stored flag), so it locks the moment a teacher is assigned. If `createdAt` is unreadable it
fails closed (locked). Rule code: `lib/profile/rules.ts` (pure, unit-testable).

## Data model (`prisma/contract.prisma`)

`ProfileChangeRequest`: `familyId`, `status` (`PENDING | APPROVED | REJECTED | CANCELLED`),
`requestedChanges` + `currentValues` (JSON, same keys; snapshot of the old values), `reason`,
`reviewedById`, `reviewedAt`, `adminNote`, `createdAt`, `updatedAt`.
A **partial unique index** allows only one `PENDING` request per family, enforced by the database.
The JSON columns are re-validated on every read and before every approval
(`lib/profile/validation.ts`); unknown keys are dropped, so a hand-edited row cannot smuggle `role` etc.

## API

Identity always comes from the session cookie. No route here reads a user id from the URL or body.

| Route | Who | Purpose |
|---|---|---|
| `GET /api/profile` | family | own profile, eligibility, request history |
| `PATCH /api/profile` | family | direct edit of `name` / `subject` (403 `PROFILE_LOCKED` when locked) |
| `POST /api/profile/change-requests` | family | submit a request (409 if one is pending, 429 after 5/hour) |
| `DELETE /api/profile/change-requests/[id]` | family | withdraw own pending request |
| `PATCH /api/profile-change-requests/[id]` | admin | `{decision: 'approve'|'reject', adminNote}`; reject needs a note |

Request bodies are **strict**: any extra key (`role`, `status`, `password`, `id`, `familyId`...) is a
400. Mutating routes also require a same-origin request.

Approval is one transaction: the request is claimed with an atomic
`UPDATE ... WHERE status = 'PENDING'` (raw SQL: the ORM's `update` re-selects then writes by id and is
not a compare-and-set), then whitelisted fields are written. An email change also clears
`emailVerifiedAt` and deletes outstanding `authToken` rows (they were issued for the old address).
A taken email returns 409 `EMAIL_TAKEN` and leaves the request pending. Whether an email is taken is
never revealed at submission time (no account enumeration).

## Admin routes that were hardened alongside this feature

`PUT`/`DELETE`/`GET /api/users/[userId]` and `POST /api/users` had no authorization at all, so any
visitor could rewrite any user (including `role`). Now: `PUT`, `DELETE`, `POST` are admin-only; `GET`
needs a signed-in user (the chat uses it) and never returns the password hash.

## Applying the schema change

The repo uses the `db update` workflow (`migrations/app/refs/db.json` is already advanced and the new
snapshot is committed). On each environment: `npx prisma db update` (7 additive operations: one table,
four indexes, two foreign keys; nothing existing is touched).

## Known gaps / ideas

- Notifications to admins/customers use `sendNotification` (`type: 'general'`) and need Firebase configured.
- Approve/reject is all-or-nothing per request (no partial approval).
