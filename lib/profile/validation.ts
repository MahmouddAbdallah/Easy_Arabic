import { z } from 'zod';
import { emailSchema, nameSchema, phoneSchema } from '@/lib/validation';
import type { ProfileField } from './rules';

/**
 * Every schema here is STRICT (`z.strictObject`): an unknown key is a 400, never silently
 * dropped. That is the guard that stops a customer from sending `role`, `status`, `password`,
 * `id`, `familyId`, `reviewedById` ... along with an otherwise legitimate request.
 * (The field rules themselves - name/email/phone - are the ones sign-up already uses.)
 */

const subjectSchema = z
    .string('Subject is required')
    .trim()
    .min(1, 'Subject is required')
    .max(50, 'Subject is too long')
    .refine((v) => !/[\r\n\t]/.test(v), 'Subject must be a single line');

const optionalNote = (label: string) =>
    z
        .string(`${label} must be text`)
        .trim()
        .max(500, `${label} is too long (maximum 500 characters)`)
        .optional()
        .transform((v) => (v ? v : undefined));

const atLeastOneKey = (value: object) => Object.keys(value).length > 0;

/** PATCH /api/profile - the only fields a customer can ever edit directly. */
export const profileDirectUpdateSchema = z
    .strictObject({
        name: nameSchema.optional(),
        subject: subjectSchema.optional(),
    })
    .refine(atLeastOneKey, 'Nothing to update');

/** The changes object of a request: any of the four fields, at least one. */
const requestedChangesShape = {
    name: nameSchema.optional(),
    subject: subjectSchema.optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
};

/** POST /api/profile/change-requests */
export const profileChangeSubmitSchema = z.strictObject({
    changes: z.strictObject(requestedChangesShape).refine(atLeastOneKey, 'Choose at least one thing to change'),
    reason: optionalNote('Reason'),
});

/** PATCH /api/profile-change-requests/[requestId] (admin). A rejection must explain itself to the customer. */
export const profileChangeReviewSchema = z
    .strictObject({
        decision: z.enum(['approve', 'reject'], 'Decision must be "approve" or "reject"'),
        adminNote: optionalNote('Note'),
    })
    .refine((v) => v.decision === 'approve' || !!v.adminNote, {
        message: 'Please tell the customer why this request is being rejected',
        path: ['adminNote'],
    });

/**
 * Shape of `requestedChanges` / `currentValues` as stored in the database. Parsed again on every
 * read (and before every approval): the column is free-form JSON, so it is never trusted blindly.
 * Unknown keys are dropped here, which is what makes it impossible for a hand-edited row to
 * smuggle a protected column into an approved update.
 */
export const storedProfileValuesSchema = z
    .object({
        name: z.string(),
        subject: z.string(),
        email: z.string(),
        phone: z.string(),
    })
    .partial();

export type ProfileValues = Partial<Record<ProfileField, string>>;

/** Lenient read for display: garbage becomes `{}` instead of crashing a page. */
export function readStoredValues(value: unknown): ProfileValues {
    const parsed = storedProfileValuesSchema.safeParse(value);
    return parsed.success ? parsed.data : {};
}

/** Strict read for approval: re-validates with the real field rules and refuses anything off. */
export const approvableChangesSchema = z
    .object(requestedChangesShape)
    .refine(atLeastOneKey, 'The request contains no changes');
