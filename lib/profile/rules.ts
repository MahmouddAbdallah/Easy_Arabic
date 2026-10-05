/**
 * Who may change what on a customer (`family`) profile. PURE: no database, no server-only
 * imports, so the API, the page and the tests all share one definition.
 *
 * Fields fall into three groups:
 *   - direct   (`name`, `subject`)  the customer may edit them themselves, but only while the
 *                                   profile is UNLOCKED.
 *   - admin    (`email`, `phone`)   ALWAYS admin-controlled. Never editable by the customer,
 *                                   not even a brand-new one. They can only ask for a change.
 *   - protected (role, status, password, ids, tokens ...) appear nowhere in this file on
 *                                   purpose: no request or update payload can name them
 *                                   (see validation.ts, which rejects unknown keys).
 *
 * The profile is LOCKED when EITHER holds:
 *   1. the family has at least one teacher assigned (a `TeacherFamily` row), or
 *   2. the account is `PROFILE_LOCK_MONTHS` months old or older.
 * Locked profiles can only change through a request that an admin approves.
 */

export const PROFILE_LOCK_MONTHS = 6;

export const DIRECT_EDIT_FIELDS = ['name', 'subject'] as const;
export const ADMIN_CONTROLLED_FIELDS = ['email', 'phone'] as const;
export const PROFILE_FIELDS = ['name', 'subject', 'email', 'phone'] as const;

export type DirectEditField = (typeof DIRECT_EDIT_FIELDS)[number];
export type AdminControlledField = (typeof ADMIN_CONTROLLED_FIELDS)[number];
export type ProfileField = (typeof PROFILE_FIELDS)[number];

export const PROFILE_FIELD_LABELS: Record<ProfileField, string> = {
    name: 'Full name',
    subject: 'Subject',
    email: 'Email address',
    phone: 'Phone number',
};

export type LockReason = 'teacher_assigned' | 'account_age';

export type ProfileEligibility = {
    /** true = the customer may edit `DIRECT_EDIT_FIELDS` themselves. */
    canEditDirectly: boolean;
    /** Why the profile is locked. Empty when it is not. Both can apply at once. */
    lockReasons: LockReason[];
    /** The instant the account-age rule locks (or locked) the profile. ISO string, or null if createdAt was unreadable. */
    ageLockDate: string | null;
    /** Fields a change request may contain right now. */
    requestableFields: ProfileField[];
};

/**
 * `date` + N calendar months in UTC, clamped to the end of a shorter month
 * (31 Aug + 6 months = 28/29 Feb, never "3 March"). Independent of the server's time zone.
 */
export function addMonthsUTC(date: Date, months: number): Date {
    const day = date.getUTCDate();
    const result = new Date(date.getTime());
    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
    result.setUTCDate(Math.min(day, lastDay));
    return result;
}

export function evaluateProfileEligibility(input: {
    /** The account's `createdAt` (ISO string, Postgres timestamptz string, or Date). */
    createdAt: string | Date;
    /** How many `TeacherFamily` rows point at this family. */
    teacherCount: number;
    now?: Date;
}): ProfileEligibility {
    const now = input.now ?? new Date();
    const created = new Date(input.createdAt);
    const createdIsValid = !Number.isNaN(created.getTime());

    const lockReasons: LockReason[] = [];
    if (input.teacherCount > 0) lockReasons.push('teacher_assigned');

    // Fail closed: if the join date can't be read we cannot prove the account is "new", so it is locked.
    const ageLockDate = createdIsValid ? addMonthsUTC(created, PROFILE_LOCK_MONTHS) : null;
    if (!ageLockDate || now.getTime() >= ageLockDate.getTime()) lockReasons.push('account_age');

    const canEditDirectly = lockReasons.length === 0;
    return {
        canEditDirectly,
        lockReasons,
        ageLockDate: ageLockDate ? ageLockDate.toISOString() : null,
        // While unlocked, name/subject are edited directly, so a request may only ask for the
        // admin-controlled fields. Once locked, a request may cover everything.
        requestableFields: canEditDirectly ? [...ADMIN_CONTROLLED_FIELDS] : [...PROFILE_FIELDS],
    };
}
