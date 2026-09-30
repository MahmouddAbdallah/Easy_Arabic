import { ContactsHeader } from "@/components/dashboard/contact/ContactsHeader";
import { ContactsTable } from "@/components/dashboard/contact/ContactsTable";
import { parseContactQuery } from "@/components/dashboard/contact/contactUtils";
import { getContacts } from "@/lib/data/contact";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ContactsPage({ searchParams }: { searchParams: SearchParams }) {
    // `query` = { keyword, status: "read" | "unread" | null, page } parsed from
    // /dashboard/contact?keyword=…&status=…&page=…  — use it to drive the data fetching below.
    const query = parseContactQuery(await searchParams);

    const { data, count } = await getContacts();

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            <ContactsHeader />
            <ContactsTable contacts={data ?? []} count={count} query={query} />
        </div>
    );
}
