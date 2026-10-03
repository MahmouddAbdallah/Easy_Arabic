'use server';

import { revalidatePath } from "next/cache";
import type { ZodType } from "zod";
import { db } from "@/prisma/db";
import { authorization } from "@/lib/verifyAuth";
import { DEFAULT_BUSINESS_HOURS, DEFAULT_CONTACT_INFO, DEFAULT_FAQS } from "@/lib/contact/defaults";
import { emptyToNull, normalizeWhatsappNumber } from "@/lib/contact/helpers";
import { CONTACT_INFO_ID } from "@/lib/contact/types";
import {
    contactChannelsSchema,
    contactContentSchema,
    contactFaqsSchema,
    contactHoursSchema,
    contactLocationSchema,
    contactSocialSchema,
    toFieldErrors,
    type ContactChannelsValues,
    type ContactContentValues,
    type ContactFaqsValues,
    type ContactHoursValues,
    type ContactLocationValues,
    type ContactSocialValues,
    type FieldErrors,
} from "@/lib/contact/validation";

/**
 * Admin-only mutations for the Contact page content. Every action:
 *   1. checks the caller is an admin,
 *   2. validates with the same Zod schema the form uses,
 *   3. writes inside a transaction,
 *   4. revalidates /contact so visitors see the change immediately.
 */

export type ContactActionResult =
    | { success: true; message: string }
    | { success: false; error: { code: string; message: string; fieldErrors?: FieldErrors } };

const fail = (code: string, message: string, fieldErrors?: FieldErrors): ContactActionResult => ({
    success: false,
    error: { code, message, fieldErrors },
});

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * First write ever: create the singleton row (and the seven weekday rows + the
 * default FAQs) from the built-in defaults, so a partial save from one section
 * never leaves the other sections empty.
 */
async function ensureSeeded(tx: Tx) {
    const existing = await tx.orm.public.ContactInfo.where({ id: CONTACT_INFO_ID }).first();
    if (existing) return;

    await tx.orm.public.ContactInfo.create({ id: CONTACT_INFO_ID, ...DEFAULT_CONTACT_INFO });
    for (const day of DEFAULT_BUSINESS_HOURS) {
        await tx.orm.public.ContactBusinessHour.create({ ...day });
    }
    for (const faq of DEFAULT_FAQS) {
        await tx.orm.public.ContactFaq.create({
            question: faq.question,
            answer: faq.answer,
            sortOrder: faq.sortOrder,
            isPublished: faq.isPublished,
        });
    }
}

/** Shared pipeline: auth → validate → transactional write → revalidate. */
async function runSectionUpdate<T>(
    name: string,
    schema: ZodType<T>,
    input: unknown,
    write: (tx: Tx, data: T) => Promise<void>,
    successMessage: string
): Promise<ContactActionResult> {
    try {
        const { error } = await authorization(["admin"]);
        if (error) return fail("FORBIDDEN", error.message);

        const parsed = schema.safeParse(input);
        if (!parsed.success) {
            const fieldErrors = toFieldErrors(parsed.error);
            return fail("VALIDATION_ERROR", Object.values(fieldErrors)[0] ?? "Invalid input", fieldErrors);
        }

        await db.transaction(async (tx) => {
            await ensureSeeded(tx);
            await write(tx, parsed.data);
        });

        revalidatePath("/contact");
        revalidatePath("/dashboard/contact/contact-info");
        return { success: true, message: successMessage };
    } catch (error) {
        console.error(`${name}:`, error);
        return fail("SERVER_ERROR", "Something went wrong while saving. Please try again.");
    }
}

const touch = () => new Date().toISOString();

export async function updateContactContent(input: ContactContentValues): Promise<ContactActionResult> {
    return runSectionUpdate(
        "updateContactContent",
        contactContentSchema,
        input,
        async (tx, data) => {
            await tx.orm.public.ContactInfo.where({ id: CONTACT_INFO_ID }).update({ ...data, updatedAt: touch() });
        },
        "Page content saved"
    );
}

export async function updateContactChannels(input: ContactChannelsValues): Promise<ContactActionResult> {
    return runSectionUpdate(
        "updateContactChannels",
        contactChannelsSchema,
        input,
        async (tx, data) => {
            await tx.orm.public.ContactInfo.where({ id: CONTACT_INFO_ID }).update({
                ...data,
                billingEmail: emptyToNull(data.billingEmail),
                whatsappNumber: normalizeWhatsappNumber(data.whatsappNumber),
                updatedAt: touch(),
            });
        },
        "Contact channels saved"
    );
}

export async function updateContactLocation(input: ContactLocationValues): Promise<ContactActionResult> {
    return runSectionUpdate(
        "updateContactLocation",
        contactLocationSchema,
        input,
        async (tx, data) => {
            await tx.orm.public.ContactInfo.where({ id: CONTACT_INFO_ID }).update({
                ...data,
                addressLine2: emptyToNull(data.addressLine2),
                stateRegion: emptyToNull(data.stateRegion),
                postalCode: emptyToNull(data.postalCode),
                updatedAt: touch(),
            });
        },
        "Location saved"
    );
}

export async function updateContactSocial(input: ContactSocialValues): Promise<ContactActionResult> {
    return runSectionUpdate(
        "updateContactSocial",
        contactSocialSchema,
        input,
        async (tx, data) => {
            await tx.orm.public.ContactInfo.where({ id: CONTACT_INFO_ID }).update({
                facebookUrl: emptyToNull(data.facebookUrl),
                instagramUrl: emptyToNull(data.instagramUrl),
                linkedinUrl: emptyToNull(data.linkedinUrl),
                xUrl: emptyToNull(data.xUrl),
                updatedAt: touch(),
            });
        },
        "Social links saved"
    );
}

export async function updateContactHours(input: ContactHoursValues): Promise<ContactActionResult> {
    return runSectionUpdate(
        "updateContactHours",
        contactHoursSchema,
        input,
        async (tx, data) => {
            await tx.orm.public.ContactInfo.where({ id: CONTACT_INFO_ID }).update({
                timezone: data.timezone,
                businessHoursNote: data.businessHoursNote,
                updatedAt: touch(),
            });
            for (const day of data.hours) {
                const values = {
                    isOpen: day.isOpen,
                    opensAt: day.isOpen ? day.opensAt : null,
                    closesAt: day.isOpen ? day.closesAt : null,
                    updatedAt: touch(),
                };
                const existing = await tx.orm.public.ContactBusinessHour.where({ dayOfWeek: day.dayOfWeek }).first();
                if (existing) {
                    await tx.orm.public.ContactBusinessHour.where({ dayOfWeek: day.dayOfWeek }).update(values);
                } else {
                    await tx.orm.public.ContactBusinessHour.create({ dayOfWeek: day.dayOfWeek, ...values });
                }
            }
        },
        "Business hours saved"
    );
}

/**
 * Replaces the FAQ list with the submitted one: rows missing from the payload
 * are deleted, rows with a known id are updated, rows without one are created.
 * Array order becomes `sortOrder`.
 */
export async function updateContactFaqs(input: ContactFaqsValues): Promise<ContactActionResult> {
    return runSectionUpdate(
        "updateContactFaqs",
        contactFaqsSchema,
        input,
        async (tx, data) => {
            const existing = await tx.orm.public.ContactFaq.all();
            const existingIds = new Set(existing.map((f) => f.id));
            const keptIds = new Set(data.faqs.map((f) => f.id).filter((id): id is string => !!id && existingIds.has(id)));

            for (const row of existing) {
                if (!keptIds.has(row.id)) await tx.orm.public.ContactFaq.where({ id: row.id }).delete();
            }

            for (const [index, faq] of data.faqs.entries()) {
                const values = { question: faq.question, answer: faq.answer, isPublished: faq.isPublished, sortOrder: index };
                if (faq.id && existingIds.has(faq.id)) {
                    await tx.orm.public.ContactFaq.where({ id: faq.id }).update({ ...values, updatedAt: touch() });
                } else {
                    await tx.orm.public.ContactFaq.create(values);
                }
            }
        },
        "FAQs saved"
    );
}
