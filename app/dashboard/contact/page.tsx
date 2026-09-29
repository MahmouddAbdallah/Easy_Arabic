import { ContactsHeader } from "@/components/dashboard/contact/ContactsHeader";
import { ContactsTable } from "@/components/dashboard/contact/ContactsTable";

export default function ContactsPage() {
    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            <ContactsHeader />
            <ContactsTable />
        </div>
    );
}