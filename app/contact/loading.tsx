import { ContactsSkeleton } from "@/components/dashboard/contact/ContactsSkeleton";

export default function Loading() {
    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <ContactsSkeleton />
        </div>
    );
}
