import { ContactsHeader } from "@/components/dashboard/contact/ContactsHeader";
import { ContactsTable } from "@/components/dashboard/contact/ContactsTable";
import { getContacts } from "@/lib/data/contact";

export default async function ContactsPage() {
    const { data } = await getContacts();

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            <ContactsHeader />
            <ContactsTable contacts={data} />
        </div>
    );
}