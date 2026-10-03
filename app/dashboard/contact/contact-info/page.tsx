import ContactInfoEditor from "@/components/dashboard/contact/info/ContactInfoEditor";
import { getContactPageContent } from "@/lib/data/contact-info";

// Always read fresh: this page is the source of truth for what admins edit.
export const dynamic = "force-dynamic";

export default async function ContactInfoPage() {
    // strict: surface a database failure (error.tsx) instead of silently showing
    // defaults, which an admin could then save over real data.
    const content = await getContactPageContent({ strict: true });

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
            <ContactInfoEditor content={content} />
        </div>
    );
}
