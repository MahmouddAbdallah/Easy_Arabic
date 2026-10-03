import { db } from "@/prisma/db";
import { DEFAULT_BUSINESS_HOURS, DEFAULT_CONTACT_INFO, DEFAULT_FAQS } from "@/lib/contact/defaults";
import { CONTACT_INFO_ID, type BusinessHourRecord, type ContactInfoFields, type ContactPageContent, type FaqRecord } from "@/lib/contact/types";

/**
 * Read side of the Contact page content (writes live in ./contact-info-actions).
 *
 * - Nothing saved yet            → built-in defaults (source: "defaults").
 * - Database unreachable         → defaults too, so the public page never 500s
 *                                  (source: "fallback"), unless `strict` is set.
 * - Otherwise                    → the rows from PostgreSQL (source: "database").
 */
export async function getContactPageContent(options: { strict?: boolean } = {}): Promise<ContactPageContent> {
    try {
        const row = await db.orm.public.ContactInfo.where({ id: CONTACT_INFO_ID }).first();

        if (!row) {
            return { info: DEFAULT_CONTACT_INFO, hours: DEFAULT_BUSINESS_HOURS, faqs: DEFAULT_FAQS, source: "defaults" };
        }

        const [hourRows, faqRows] = await Promise.all([
            db.orm.public.ContactBusinessHour.all(),
            db.orm.public.ContactFaq.orderBy((f) => f.sortOrder.asc()).all(),
        ]);

        const { id: _id, updatedAt: _updatedAt, ...info } = row;
        void _id;
        void _updatedAt;

        const hours: BusinessHourRecord[] = DEFAULT_BUSINESS_HOURS.map((fallback) => {
            const saved = hourRows.find((h) => h.dayOfWeek === fallback.dayOfWeek);
            return saved
                ? { dayOfWeek: saved.dayOfWeek, isOpen: saved.isOpen, opensAt: saved.opensAt, closesAt: saved.closesAt }
                : fallback;
        });

        const faqs: FaqRecord[] = faqRows.map((f) => ({
            id: f.id,
            question: f.question,
            answer: f.answer,
            sortOrder: f.sortOrder,
            isPublished: f.isPublished,
        }));

        return { info: info as ContactInfoFields, hours, faqs, source: "database" };
    } catch (error) {
        console.error("getContactPageContent:", error);
        if (options.strict) throw error;
        return { info: DEFAULT_CONTACT_INFO, hours: DEFAULT_BUSINESS_HOURS, faqs: DEFAULT_FAQS, source: "fallback" };
    }
}
