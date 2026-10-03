import { z } from 'zod';
import { fcmTokenSchema } from '@/lib/validation';
import { NOTIFICATION_TYPES, isSafeAssetUrl, isSafeInternalLink } from './contract';

/** Upper bounds that keep one call (and one FCM payload) well within sane limits. */
export const MAX_USER_IDS = 1000;
export const MAX_TOKENS = 5000;
const MAX_DATA_ENTRIES = 20;
const MAX_TTL_SECONDS = 28 * 24 * 60 * 60; // FCM's own maximum

// One definition of "what a valid FCM token looks like" for the whole project.
const fcmToken = fcmTokenSchema.shape.fcmToken;
const identifier = z.string().trim().min(1).max(128);

/**
 * Runtime validation for `sendNotification()` input. The compile-time types live in
 * sendNotification.ts; this schema is the safety net for JS callers and bad data.
 * Unknown keys are rejected so a typo like `bdoy` fails loudly instead of being ignored.
 */
export const sendNotificationSchema = z
    .strictObject({
        // Recipients — exactly one of these four (enforced below).
        userId: identifier.optional(),
        userIds: z.array(identifier).min(1).max(MAX_USER_IDS).optional(),
        token: fcmToken.optional(),
        tokens: z.array(fcmToken).min(1).max(MAX_TOKENS).optional(),

        // Content
        title: z.string().trim().min(1, 'title is required').max(200, 'title is too long (max 200)'),
        body: z.string().trim().min(1, 'body is required').max(1000, 'body is too long (max 1000)'),
        type: z.enum(NOTIFICATION_TYPES).default('general'),
        link: z
            .string()
            .trim()
            .refine(isSafeInternalLink, 'link must be an internal path starting with a single "/" (e.g. "/chat")')
            .optional(),
        icon: z.string().trim().refine(isSafeAssetUrl, 'icon must be an internal path or an https URL').optional(),
        image: z.string().trim().refine(isSafeAssetUrl, 'image must be an internal path or an https URL').optional(),
        tag: z.string().trim().min(1).max(100).optional(),
        data: z
            .record(z.string().min(1).max(64), z.union([z.string().max(500), z.number(), z.boolean()]))
            .refine((d) => Object.keys(d).length <= MAX_DATA_ENTRIES, `data can hold at most ${MAX_DATA_ENTRIES} entries`)
            .optional(),

        // Delivery overrides (defaults come from NOTIFICATION_TYPE_CONFIG)
        urgency: z.enum(['very-low', 'low', 'normal', 'high']).optional(),
        ttlSeconds: z.number().int().min(0).max(MAX_TTL_SECONDS).optional(),
    })
    .refine(
        (input) => [input.userId, input.userIds, input.token, input.tokens].filter((r) => r !== undefined).length === 1,
        { message: 'Provide exactly one recipient: userId, userIds, token or tokens' }
    );

export type ValidatedNotificationInput = z.output<typeof sendNotificationSchema>;

/**
 * Body of PATCH /api/notification/read: mark some notifications, or every unread one, as read.
 * The client only needs the inferred type (`import type`), so zod never reaches the browser bundle.
 */
export const MAX_MARK_READ_IDS = 100;

// Firestore document ids: no slashes, nothing that could escape the collection path.
const documentId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, 'Invalid notification id');

export const markReadSchema = z.union([
    z.strictObject({ ids: z.array(documentId).min(1).max(MAX_MARK_READ_IDS) }),
    z.strictObject({ all: z.literal(true) }),
]);

export type MarkReadInput = z.infer<typeof markReadSchema>;

/** "title: title is required; link: link must be ..." — readable in logs and API responses. */
export function formatValidationIssues(error: z.ZodError): string {
    return error.issues
        .map((issue) => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
        .join('; ');
}
