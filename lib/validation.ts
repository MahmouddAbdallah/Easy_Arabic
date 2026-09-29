import { z } from "zod";

export const RoleEnum = z.enum(['family', 'teacher', 'admin']);
export const StatusEnum = z.enum(['active', 'banned', 'suspended']);

export const userSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(1, 'Phone is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: RoleEnum.default('family'),
    status: StatusEnum.default('active'),
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

// Infer TypeScript type directly from the schema
export const signInSchema = z.object({
    email: z.email(),
    password: z.string().min(1, 'Password is required'),
});

export const signUpSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.email(),
    phone: z.string().min(1, 'Phone is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const profileUpdateSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.email(),
    phone: z.string().min(1, 'Phone is required'),
});

export const passwordChangeSchema = z.object({
    password: z.string().min(1),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const passwordResetSchema = z.object({
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});


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
export function firstValidationMessage(error: z.ZodError): string {
    return error.issues[0]?.message ?? 'Invalid input';
}

export const contactSchema = z.object({
    name: z.string('Please enter the name'),
    email: z.string().email('Please enter valid email!'),
    phone: z.preprocess(
        (val) => (val === '' ? undefined : val),
        z.string().optional().nullable()
    ),
    message: z.string('Please enter your message')
});