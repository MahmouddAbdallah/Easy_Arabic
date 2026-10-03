import { z } from "zod";
import { emailSchema } from "@/lib/validation";

/**
 * Validation for the Contact page editor. One schema per dashboard section;
 * the SAME schemas run in the browser (before submitting) and in the server
 * actions (authoritative), so the rules can never drift apart.
 *
 * Optional text fields are plain strings here ("" = not set). The server
 * converts "" to NULL before writing (see `emptyToNull` in ./helpers).
 */

const required = (label: string, max: number) =>
    z
        .string(`${label} is required`)
        .trim()
        .min(1, `${label} is required`)
        .max(max, `${label} must be ${max} characters or fewer`);

const optional = (label: string, max: number) =>
    z.string().trim().max(max, `${label} must be ${max} characters or fewer`);

const isHttpUrl = (value: string) => {
    try {
        const { protocol } = new URL(value);
        return protocol === "https:" || protocol === "http:";
    } catch {
        return false;
    }
};

/** Optional http(s) URL; when `hosts` is given the hostname must belong to one of them. */
const optionalUrl = (label: string, hosts?: string[]) =>
    z
        .string()
        .trim()
        .max(300, `${label} link is too long`)
        .refine((v) => v === "" || isHttpUrl(v), `Enter a valid ${label} link starting with https://`)
        .refine((v) => {
            if (v === "" || !hosts || !isHttpUrl(v)) return true;
            const host = new URL(v).hostname.replace(/^www\./, "");
            return hosts.some((h) => host === h || host.endsWith(`.${h}`));
        }, `This doesn’t look like a ${label} link`);

const digitsOf = (value: string) => value.replace(/\D/g, "");

const phoneField = (label: string) =>
    required(label, 30)
        .regex(/^\+?[\d\s().-]+$/, "Use digits, spaces and + ( ) - only")
        .refine((v) => digitsOf(v).length >= 7 && digitsOf(v).length <= 15, "Enter a valid phone number (7–15 digits)");

const optionalEmail = z
    .string()
    .trim()
    .max(254, "Email is too long")
    .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address");

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const isValidTimezone = (tz: string) => {
    try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
    } catch {
        return false;
    }
};

/* ------------------------------- sections -------------------------------- */

/** Hero, highlights strip, form copy and FAQ section header. */
export const contactContentSchema = z.object({
    heroBadgeText: required("Status badge", 80),
    heroHeadline: required("Headline", 140),
    heroDescription: required("Description", 400),

    responseTime: required("Response time", 60),
    supportLanguages: required("Support languages", 80),
    trialLessonText: required("Trial lesson text", 80),

    formTitle: required("Form title", 80),
    formDescription: required("Form description", 200),
    formSuccessTitle: required("Success title", 80),
    formSuccessMessage: required("Success message", 300),

    faqTitle: required("FAQ title", 120),
    faqDescription: required("FAQ description", 300),
});

/** Phone, emails and WhatsApp. */
export const contactChannelsSchema = z.object({
    phoneLabel: required("Phone label", 40),
    phoneNumber: phoneField("Phone number"),
    phoneNote: required("Phone note", 100),

    supportEmailLabel: required("Email label", 40),
    supportEmail: emailSchema,
    supportEmailNote: required("Email note", 100),

    billingEmail: optionalEmail,

    whatsappNumber: z
        .string()
        .trim()
        .max(30, "WhatsApp number is too long")
        .refine((v) => v === "" || /^\+?[\d\s().-]+$/.test(v), "Use digits, spaces and + ( ) - only")
        .refine((v) => v === "" || (digitsOf(v).length >= 8 && digitsOf(v).length <= 15), "Include the country code (8–15 digits)"),
    whatsappTitle: required("WhatsApp title", 60),
    whatsappDescription: required("WhatsApp description", 200),
    whatsappButtonLabel: required("Button label", 40),
    whatsappPrefilledMessage: required("Pre-filled message", 200),
});

/** Office address and map pin. */
export const contactLocationSchema = z.object({
    officeName: required("Office name", 80),
    addressLine1: required("Address line 1", 120),
    addressLine2: optional("Address line 2", 120),
    city: required("City", 60),
    stateRegion: optional("State / region", 60),
    postalCode: optional("Postal code", 20),
    country: required("Country", 60),
    latitude: z
        .number("Enter a valid latitude")
        .min(-90, "Latitude must be between -90 and 90")
        .max(90, "Latitude must be between -90 and 90"),
    longitude: z
        .number("Enter a valid longitude")
        .min(-180, "Longitude must be between -180 and 180")
        .max(180, "Longitude must be between -180 and 180"),
});

export const businessHourSchema = z
    .object({
        dayOfWeek: z.number().int().min(0).max(6),
        isOpen: z.boolean(),
        opensAt: z.string().trim(),
        closesAt: z.string().trim(),
    })
    .superRefine((day, ctx) => {
        if (!day.isOpen) return;
        if (!HHMM.test(day.opensAt)) {
            ctx.addIssue({ code: "custom", path: ["opensAt"], message: "Set an opening time" });
        }
        if (!HHMM.test(day.closesAt)) {
            ctx.addIssue({ code: "custom", path: ["closesAt"], message: "Set a closing time" });
        }
        if (HHMM.test(day.opensAt) && HHMM.test(day.closesAt) && day.opensAt >= day.closesAt) {
            ctx.addIssue({ code: "custom", path: ["closesAt"], message: "Must be after opening time" });
        }
    });

/** Time zone, note and the 7 weekday rows. */
export const contactHoursSchema = z.object({
    timezone: z
        .string("Time zone is required")
        .trim()
        .min(1, "Time zone is required")
        .refine(isValidTimezone, "Enter a valid time zone, e.g. Africa/Cairo"),
    businessHoursNote: required("Hours note", 160),
    hours: z
        .array(businessHourSchema)
        .length(7, "All seven days are required")
        .refine((days) => new Set(days.map((d) => d.dayOfWeek)).size === 7, "Each weekday must appear once"),
});

/** Social profile links. */
export const contactSocialSchema = z.object({
    facebookUrl: optionalUrl("Facebook", ["facebook.com", "fb.com"]),
    instagramUrl: optionalUrl("Instagram", ["instagram.com"]),
    linkedinUrl: optionalUrl("LinkedIn", ["linkedin.com"]),
    xUrl: optionalUrl("X / Twitter", ["x.com", "twitter.com"]),
});

export const MAX_FAQS = 20;

export const faqItemSchema = z.object({
    /** Present for rows that already exist in the database. */
    id: z.string().optional(),
    question: required("Question", 200),
    answer: required("Answer", 1000),
    isPublished: z.boolean(),
});

export const contactFaqsSchema = z.object({
    faqs: z.array(faqItemSchema).max(MAX_FAQS, `You can add up to ${MAX_FAQS} questions`),
});

export type ContactContentValues = z.infer<typeof contactContentSchema>;
export type ContactChannelsValues = z.infer<typeof contactChannelsSchema>;
export type ContactLocationValues = z.infer<typeof contactLocationSchema>;
export type ContactHoursValues = z.infer<typeof contactHoursSchema>;
export type ContactSocialValues = z.infer<typeof contactSocialSchema>;
export type ContactFaqsValues = z.infer<typeof contactFaqsSchema>;

export type FieldErrors = Record<string, string>;

/** Flattens a ZodError into `{ "hours.2.closesAt": "Must be after opening time" }` (first message per path). */
export function toFieldErrors(error: z.ZodError): FieldErrors {
    const out: FieldErrors = {};
    for (const issue of error.issues) {
        const key = issue.path.join(".");
        if (!(key in out)) out[key] = issue.message;
    }
    return out;
}
