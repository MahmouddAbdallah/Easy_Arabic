import { z } from "zod";

export const RoleEnum = z.enum(['family', 'teacher', 'admin']);
export const StatusEnum = z.enum(['active', 'banned', 'suspended']);

/* ---------------------------------------------------------------------------
 * Shared building blocks. Every auth-related schema below reuses these, so the
 * rules for e-mail and password can never drift between Sign Up, Reset
 * Password, Change Password and the admin user routes.
 * ------------------------------------------------------------------------ */

/** Trimmed, lower-cased, length-capped, valid address. */
export const emailSchema = z
    .string('Email is required')
    .trim()
    .toLowerCase()
    .max(254, 'Email is too long')
    .pipe(z.email('Enter a valid email address'));

// bcrypt only uses the first 72 bytes. Rejecting longer input (rather than
// silently truncating it) keeps "what you typed" == "what is checked", and
// bounds the work an attacker can force per request.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

/**
 * Deliberately light: length only (plus "not blank"). No forced symbols or
 * digits, so ordinary passphrases work.
 */
export const passwordSchema = z
    .string('Password is required')
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .refine((v) => new TextEncoder().encode(v).length <= PASSWORD_MAX_BYTES, `Password is too long (maximum ${PASSWORD_MAX_BYTES} bytes)`)
    .refine((v) => v.trim().length > 0, 'Password cannot be only spaces')
    .refine((v) => !v.includes('\0'), 'Password contains invalid characters');

/** For sign-in the password is only compared, never stored: accept whatever a legacy account may have, but cap it. */
const loginPasswordSchema = z.string('Password is required').min(1, 'Password is required').max(1024, 'Password is too long');

export const nameSchema = z.string('Name is required').trim().min(1, 'Name is required').max(100, 'Name is too long');

export const phoneSchema = z
    .string('Phone is required')
    .trim()
    .min(1, 'Phone is required')
    .max(30, 'Phone number is too long')
    .regex(/^[+\d\s().-]+$/, 'Enter a valid phone number')
    .optional();

/** One-time tokens are 43-char base64url strings; cap the length so junk can't be hashed at scale. */
const tokenSchema = z.string('Token is required').trim().min(20, 'Invalid or expired link').max(200, 'Invalid or expired link');

export const userSchema = z.object({
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    role: RoleEnum.default('family'),
    status: StatusEnum.default('active'),
});

/**
 * Update payload for the admin edit route. NOT `userSchema.partial()`: in Zod 4
 * that keeps the `.default()`s, so an edit that only sent `{ name }` silently
 * reset `role` to "family" and `status` to "active" (un-banning users).
 */


export const userUpdateSchema = z.object({
    name: nameSchema,
    imageUrl: z.string('please enter real url').optional(),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    role: RoleEnum,
    status: StatusEnum,
}).partial();



export const fcmTokenSchema = z.object({
    fcmToken: z
        .string()
        .min(30, 'Invalid FCM token length')
        .regex(/^[a-zA-Z0-9_:-]+$/, 'Invalid FCM token format'),
    deviceType: z.string().optional(),
});


export const addFamilyToTeacherSchema = z.object({
    teacherId: z
        .string("Teacher ID must be a string")
        .trim()
        .uuid("Invalid Teacher ID format"),

    familiesIds: z
        .array(
            z.string("Family ID must be a string")
                .trim()
                .uuid("Invalid Family ID format")
        ),
});

export const addTeachersToFamilySchema = z.object({
    familyId: z
        .string("Family ID must be a string")
        .trim()
        .uuid("Invalid Family ID format"),

    teachersIds: z
        .array(
            z.string("Teacher ID must be a string")
                .trim()
                .uuid("Invalid Teacher ID format")
        )
        .min(1, "Select at least one teacher"),
});

export const signInSchema = z.object({
    email: emailSchema,
    password: loginPasswordSchema,
});

export const signUpSchema = z.object({
    name: nameSchema,
    imageUrl: z.string('please enter real url').optional(),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
});

export const profileUpdateSchema = z.object({
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resendVerificationSchema = z.object({ email: emailSchema });

export const verifyEmailSchema = z.object({ token: tokenSchema });

export const passwordResetSchema = z.object({
    token: tokenSchema,
    newPassword: passwordSchema,
});

export const passwordChangeSchema = z.object({
    currentPassword: loginPasswordSchema,
    newPassword: passwordSchema,
});

/** An admin sets someone else's password directly: no current password and no email token. */
export const adminPasswordResetSchema = z.object({ newPassword: passwordSchema });

export const lessonSchema = z.object({
    teacherId: z.string('teacherId is required'),
    familyId: z.string('familyId is required'),
    student: z.string().min(1, "Student name is required"),
    status: z.string(),
    classDate: z.coerce.date(),
    duration: z.coerce.number('Duration is required'),
    TeacherReward: z.string('Teacher Reward is required'),
});

export const moneyPerLessonSchema = z.object({
    money: z.coerce
        .number('Money must be a valid number')
        .min(0, "Amount cannot be negative")
        .int("Amount must be a whole number"),
    teacherId: z
        .string("Teacher ID must be a string")
        .trim()
        .uuid("Invalid Teacher ID format"),
});

export const landingSectionCreateSchema = z.object({
    type: z.string().min(1),
    title: z.string().nullable().optional(),
    subtitle: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    ctaLabel: z.string().nullable().optional(),
    ctaHref: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    content: z.any().optional(),
    isActive: z.boolean().optional(),
});

export const landingSectionUpdateSchema = landingSectionCreateSchema.extend({
    type: z.string().min(1).optional(),
});

export const reorderSchema = z.object({
    order: z.array(z.string().min(1)).min(1),
});

/** Shared helper so every route formats a Zod failure into the same
 * {success:false,error:{code,message}} shape instead of each one
 * re-deriving the message slightly differently. */

export const contactSchema = z.object({
    name: z.string('Please enter the name'),
    email: z.string().email('Please enter valid email!'),
    phone: z.preprocess(
        (val) => (val === '' ? undefined : val),
        z.string().optional().nullable()
    ),
    message: z.string('Please enter your message')
});

export function firstValidationMessage(error: z.ZodError): string {
    return error.issues[0]?.message ?? 'Invalid input';
}