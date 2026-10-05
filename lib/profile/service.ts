import 'server-only';
import { db } from '@/prisma/db';
import { consume, rateLimitKey } from '@/lib/auth/rateLimit';
import { isUniqueViolation } from '@/lib/apiResponse';
import { findUserByEmail, normalizeEmail } from '@/lib/auth/users';
import { authorization } from '@/lib/verifyAuth';
import {
    DIRECT_EDIT_FIELDS,
    evaluateProfileEligibility,
    type DirectEditField,
    type ProfileEligibility,
    type ProfileField,
} from './rules';
import {
    approvableChangesSchema,
    readStoredValues,
    type ProfileValues,
} from './validation';

/**
 * ALL profile business rules live here, not in the routes or the UI:
 *   - the identity is always the `userId` the caller passes in, which routes take from the
 *     verified session and from nowhere else;
 *   - the 6-month / TeacherFamily lock is re-evaluated from the database on every call;
 *   - writes are built field by field from whitelists, never by spreading a request body.
 */

export type ServiceError = { ok: false; status: number; code: string; message: string };
export type ServiceResult<T> = { ok: true; data: T } | ServiceError;

/** Postgres timestamptz text -> ISO 8601. Safari cannot parse "2026-09-24 20:39:54+00"; every browser parses ISO. */
const iso = (value: string): string => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
};

const fail = (status: number, code: string, message: string): ServiceError => ({ ok: false, status, code, message });
const ok = <T,>(data: T): ServiceResult<T> => ({ ok: true, data });

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

/* ──────────────  Atomic PENDING -> final transitions (raw SQL on purpose)  ──────────────
 * The ORM's `where(...).update(...)` is "SELECT id ... WHERE <predicate>" followed by
 * "UPDATE ... WHERE id = <that id>": the predicate is NOT re-checked at write time, so two
 * concurrent callers can both "win". A request must be decided exactly once (approve vs. approve,
 * approve vs. withdraw), so the status check and the write happen in ONE statement: the first
 * caller changes the row, every later one matches nothing and gets zero rows back. */

type Runner = { query: (plan: any) => PromiseLike<any> };
const defaultRunner: Runner = { query: (plan) => db.runtime().query(plan) };
const TEXT = 'pg/text@1';

/** PENDING -> APPROVED/REJECTED. true only for the one call that actually made the change. */
async function decidePending(
    runner: Runner,
    args: { id: string; to: 'APPROVED' | 'REJECTED'; adminId: string; adminNote: string | null }
): Promise<boolean> {
    const plan = db.raw.sql`
        UPDATE "profileChangeRequest"
        SET "status" = ${args.to}, "reviewedById" = ${args.adminId}, "reviewedAt" = now(),
            "adminNote" = NULLIF(${args.adminNote ?? ''}, ''), "updatedAt" = now()
        WHERE "id" = ${args.id} AND "status" = 'PENDING'
        RETURNING "id"
    `.returnsRow({ id: TEXT }).build();
    const rows = (await runner.query(plan)) as unknown[];
    return rows.length > 0;
}

/** PENDING -> CANCELLED, only for the owner's own row. */
async function withdrawPending(id: string, familyId: string): Promise<boolean> {
    const plan = db.raw.sql`
        UPDATE "profileChangeRequest"
        SET "status" = 'CANCELLED', "updatedAt" = now()
        WHERE "id" = ${id} AND "familyId" = ${familyId} AND "status" = 'PENDING'
        RETURNING "id"
    `.returnsRow({ id: TEXT }).build();
    const rows = (await db.runtime().query(plan)) as unknown[];
    return rows.length > 0;
}

/** Customers can submit at most this many requests per window (withdraw-and-resubmit loops included). */
const SUBMIT_LIMIT = { limit: 5, windowSeconds: 60 * 60 };
const HISTORY_LIMIT = 10;
const ADMIN_PAGE_SIZE = 10;

/* ─────────────────────────────  Customer side  ───────────────────────────── */

/** The customer's own profile. Deliberately has NO role, status, password, token or reviewer id. */
export type OwnProfile = {
    name: string;
    email: string;
    phone: string;
    subject: string;
    /** Join date. */
    createdAt: string;
};

/** A request as the customer sees it: no internal ids besides the request's own, no reviewer identity. */
export type CustomerRequest = {
    id: string;
    status: RequestStatus;
    requestedChanges: ProfileValues;
    currentValues: ProfileValues;
    reason: string | null;
    adminNote: string | null;
    reviewedAt: string | null;
    createdAt: string;
};

export type ProfileOverview = {
    profile: OwnProfile;
    eligibility: ProfileEligibility;
    pendingRequest: CustomerRequest | null;
    /** Newest first, includes the pending one. */
    requests: CustomerRequest[];
};

const toCustomerRequest = (row: {
    id: string;
    status: RequestStatus;
    requestedChanges: unknown;
    currentValues: unknown;
    reason: string | null;
    adminNote: string | null;
    reviewedAt: string | null;
    createdAt: string;
}): CustomerRequest => ({
    id: row.id,
    status: row.status,
    requestedChanges: readStoredValues(row.requestedChanges),
    currentValues: readStoredValues(row.currentValues),
    reason: row.reason,
    adminNote: row.adminNote,
    reviewedAt: row.reviewedAt ? iso(row.reviewedAt) : null,
    createdAt: iso(row.createdAt),
});

async function loadOwnProfile(userId: string) {
    const [user, teachers] = await Promise.all([
        db.orm.public.User.where({ id: userId }).select('name', 'email', 'phone', 'subject', 'createdAt', 'role').first(),
        db.orm.public.TeacherFamily.where({ familyId: userId }).aggregate((a) => ({ count: a.count() })),
    ]);
    // Defence in depth: the routes already require the `family` role.
    if (!user || user.role !== 'family') return null;

    // Explicit whitelist: a column added to `User` later can never leak to the customer by accident.
    const profile: OwnProfile = { name: user.name, email: user.email, phone: user.phone, subject: user.subject, createdAt: iso(user.createdAt) };
    const eligibility = evaluateProfileEligibility({ createdAt: user.createdAt, teacherCount: teachers.count });
    return { profile, eligibility };
}

export async function getProfileOverview(userId: string): Promise<ServiceResult<ProfileOverview>> {
    const own = await loadOwnProfile(userId);
    if (!own) return fail(404, 'NOT_FOUND', 'Profile not found.');

    const rows = await db.orm.public.ProfileChangeRequest
        .where({ familyId: userId })
        .select('id', 'status', 'requestedChanges', 'currentValues', 'reason', 'adminNote', 'reviewedAt', 'createdAt')
        .orderBy((r) => r.createdAt.desc())
        .limit(HISTORY_LIMIT)
        .all();

    const requests = rows.map(toCustomerRequest);
    return ok({ ...own, requests, pendingRequest: requests.find((r) => r.status === 'PENDING') ?? null });
}

/**
 * Direct edit of the allowed fields. Refused (403) once the profile is locked.
 * `input` has already passed `profileDirectUpdateSchema`, which allows ONLY `name` and `subject`.
 */
export async function updateOwnProfile(
    userId: string,
    input: Partial<Record<DirectEditField, string>>
): Promise<ServiceResult<OwnProfile>> {
    const own = await loadOwnProfile(userId);
    if (!own) return fail(404, 'NOT_FOUND', 'Profile not found.');

    if (!own.eligibility.canEditDirectly) {
        return fail(403, 'PROFILE_LOCKED', 'Your profile is locked. Please send a change request to the admin instead.');
    }

    // Whitelist, field by field. Nothing else can reach the UPDATE.
    // (Eligibility is checked just above, not inside the UPDATE: keeping the 6-month rule in ONE
    // place - rules.ts - is worth more than closing a millisecond window on two cosmetic fields.)
    const patch: Partial<Record<DirectEditField, string>> = {};
    for (const field of DIRECT_EDIT_FIELDS) {
        const value = input[field];
        if (value !== undefined && value !== own.profile[field]) patch[field] = value;
    }
    if (Object.keys(patch).length === 0) return fail(400, 'NO_CHANGES', 'Nothing changed.');

    await db.orm.public.User.where({ id: userId }).update({ ...patch, updatedAt: new Date().toISOString() });
    return ok({ ...own.profile, ...patch });
}

/** Normalised the same way the stored value would be, so "same value" comparisons are reliable. */
const normalise = (field: ProfileField, value: string) => (field === 'email' ? normalizeEmail(value) : value.trim());

export async function submitChangeRequest(
    userId: string,
    input: { changes: Partial<Record<ProfileField, string>>; reason?: string }
): Promise<ServiceResult<CustomerRequest>> {
    const own = await loadOwnProfile(userId);
    if (!own) return fail(404, 'NOT_FOUND', 'Profile not found.');

    // 1. Only fields that are requestable *right now*: while the profile is unlocked, name/subject
    //    are edited directly, so a request may only ask for email/phone.
    const requested: ProfileValues = {};
    const current: ProfileValues = {};
    for (const [key, raw] of Object.entries(input.changes) as [ProfileField, string][]) {
        if (!own.eligibility.requestableFields.includes(key)) {
            return fail(400, 'FIELD_NOT_REQUESTABLE', 'You can change your name and subject directly - no request needed.');
        }
        const value = normalise(key, raw);
        // Unchanged fields are dropped rather than sent to the admin.
        if (value === own.profile[key]) continue;
        requested[key] = value;
        current[key] = own.profile[key];
    }
    if (Object.keys(requested).length === 0) {
        return fail(400, 'NO_CHANGES', 'The requested values are the same as your current details.');
    }

    // 2. One open request at a time (friendly check; the partial unique index is the real guarantee).
    const open = await db.orm.public.ProfileChangeRequest.where({ familyId: userId, status: 'PENDING' }).select('id').first();
    if (open) return fail(409, 'REQUEST_ALREADY_PENDING', 'You already have a request waiting for the admin. Wait for the answer, or withdraw it first.');

    // 3. Throttle (after the cheap checks, so a rejected duplicate doesn't burn a slot).
    const limited = await consume(rateLimitKey('profile-request:user', userId), SUBMIT_LIMIT);
    if (!limited.allowed) {
        return fail(429, 'TOO_MANY_REQUESTS', 'You have sent several requests recently. Please try again later.');
    }

    try {
        const row = await db.orm.public.ProfileChangeRequest.create({
            familyId: userId,
            requestedChanges: requested,
            currentValues: current,
            reason: input.reason ?? null,
        });
        return ok(toCustomerRequest(row as Parameters<typeof toCustomerRequest>[0]));
    } catch (error) {
        // Two simultaneous submissions: the unique index lets exactly one in.
        if (isUniqueViolation(error)) {
            return fail(409, 'REQUEST_ALREADY_PENDING', 'You already have a request waiting for the admin.');
        }
        throw error;
    }
}

/** Customer withdraws their own pending request. Someone else's id behaves exactly like a missing one. */
export async function cancelChangeRequest(userId: string, requestId: string): Promise<ServiceResult<null>> {
    if (await withdrawPending(requestId, userId)) return ok(null);

    const exists = await db.orm.public.ProfileChangeRequest.where({ id: requestId, familyId: userId }).select('id').first();
    if (!exists) return fail(404, 'NOT_FOUND', 'Request not found.');
    return fail(409, 'NOT_PENDING', 'This request has already been answered, so it can no longer be withdrawn.');
}

/* ───────────────────────────────  Admin side  ─────────────────────────────── */

export type AdminRequest = CustomerRequest & {
    family: { id: string; name: string; email: string; phone: string; subject: string } | null;
    reviewerName: string | null;
};

export type AdminRequestList = {
    requests: AdminRequest[];
    /** Rows matching the current filter (for pagination). */
    count: number;
    pageSize: number;
    /** Per-status totals for the tabs, always across all statuses. */
    totals: Record<RequestStatus, number> & { all: number };
};

export const REQUEST_STATUSES: RequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

/** Admin-only listing for the dashboard. Re-checks the session itself, like every other data helper. */
export async function listProfileChangeRequests(opts: { status?: RequestStatus | null; page?: number }): Promise<ServiceResult<AdminRequestList>> {
    const { error } = await authorization(['admin']);
    if (error) return fail(403, 'FORBIDDEN', 'Forbidden');

    const page = Math.max(1, opts.page ?? 1);
    const R = db.orm.public.ProfileChangeRequest;
    const filtered = opts.status ? R.where({ status: opts.status }) : R;

    const [count, groups, rows] = await Promise.all([
        filtered.aggregate((a) => ({ count: a.count() })),
        R.groupBy('status').aggregate((a) => ({ count: a.count() })),
        filtered
            .orderBy([(r) => r.createdAt.desc(), (r) => r.id.asc()])
            .offset((page - 1) * ADMIN_PAGE_SIZE)
            .limit(ADMIN_PAGE_SIZE)
            .include('family', (f) => f.select('id', 'name', 'email', 'phone', 'subject'))
            .include('reviewer', (u) => u.select('name'))
            .all(),
    ]);

    const totals = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0, all: 0 };
    for (const g of groups) {
        totals[g.status as RequestStatus] = g.count;
        totals.all += g.count;
    }

    const requests: AdminRequest[] = rows.map((row) => ({
        ...toCustomerRequest(row as Parameters<typeof toCustomerRequest>[0]),
        family: row.family ?? null,
        reviewerName: row.reviewer?.name ?? null,
    }));
    return ok({ requests, count: count.count, pageSize: ADMIN_PAGE_SIZE, totals });
}

export type ReviewOutcome = { status: 'APPROVED' | 'REJECTED'; familyId: string; applied: ProfileField[] };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Approve or reject a pending request. `adminId` must come from a verified admin session.
 *
 * Approval is one transaction: the request is first claimed (PENDING -> APPROVED, so two admins
 * cannot both apply it), then the whitelisted changes are written. If anything fails, including
 * a taken email, the claim is rolled back and the request stays pending.
 */
export async function reviewChangeRequest(
    adminId: string,
    requestId: string,
    review: { decision: 'approve' | 'reject'; adminNote?: string }
): Promise<ServiceResult<ReviewOutcome>> {
    const request = await db.orm.public.ProfileChangeRequest.where({ id: requestId }).first();
    if (!request) return fail(404, 'NOT_FOUND', 'Request not found.');
    if (request.status !== 'PENDING') return fail(409, 'ALREADY_REVIEWED', 'This request has already been answered.');

    const adminNote = review.adminNote ?? null;

    if (review.decision === 'reject') {
        const claimed = await decidePending(defaultRunner, { id: requestId, to: 'REJECTED', adminId, adminNote });
        if (!claimed) return fail(409, 'ALREADY_REVIEWED', 'This request has already been answered.');
        return ok({ status: 'REJECTED', familyId: request.familyId, applied: [] });
    }

    // Re-validate the stored JSON with the real field rules; unknown keys are stripped here.
    const parsed = approvableChangesSchema.safeParse(request.requestedChanges);
    if (!parsed.success) {
        return fail(422, 'INVALID_REQUEST_DATA', 'This request contains invalid data and cannot be applied. Please reject it.');
    }
    const changes = parsed.data;

    const family = await db.orm.public.User.where({ id: request.familyId }).select('id', 'role', 'email').first();
    if (!family || family.role !== 'family') {
        return fail(409, 'FAMILY_NOT_FOUND', 'The customer account no longer exists, so this request cannot be applied.');
    }

    const emailChanging = changes.email !== undefined && changes.email !== normalizeEmail(family.email);
    if (emailChanging) {
        const taken = await findUserByEmail(changes.email!);
        if (taken && taken.id !== family.id) {
            return fail(409, 'EMAIL_TAKEN', 'That email address already belongs to another account. Reject the request and explain why.');
        }
    }

    try {
        const outcome = await db.transaction(async (tx: Tx) => {
            const claimed = await decidePending(tx, { id: requestId, to: 'APPROVED', adminId, adminNote });
            if (!claimed) return null;

            // Field-by-field whitelist; `role`, `status`, `password` ... have no way in.
            const patch: Partial<Record<ProfileField, string>> & { emailVerifiedAt?: null } = {};
            if (changes.name !== undefined) patch.name = changes.name;
            if (changes.subject !== undefined) patch.subject = changes.subject;
            if (changes.phone !== undefined) patch.phone = changes.phone;
            if (emailChanging) {
                patch.email = changes.email;
                // The new address has not been proven yet.
                patch.emailVerifiedAt = null;
            }
            await tx.orm.public.User.where({ id: family.id }).update({ ...patch, updatedAt: new Date().toISOString() });

            // Outstanding reset / verification links were issued for the OLD address. Raw SQL on
            // purpose: the ORM's `where().delete()` removes a single row, and we need them all gone.
            if (emailChanging) {
                await tx.execute(db.raw.sql`DELETE FROM "authToken" WHERE "userId" = ${family.id}`.affectedCount().build());
            }
            return true;
        });
        if (!outcome) return fail(409, 'ALREADY_REVIEWED', 'This request has already been answered.');
    } catch (error) {
        if (isUniqueViolation(error)) {
            return fail(409, 'EMAIL_TAKEN', 'That email address already belongs to another account. Reject the request and explain why.');
        }
        throw error;
    }

    const applied = (Object.keys(changes) as ProfileField[]).filter((f) => changes[f] !== undefined);
    return ok({ status: 'APPROVED', familyId: request.familyId, applied });
}

/** Ids of every admin, for notifications. */
export async function getAdminIds(): Promise<string[]> {
    const admins = await db.orm.public.User.where({ role: 'admin' }).select('id').all();
    return admins.map((a) => a.id);
}
