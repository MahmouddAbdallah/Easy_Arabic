import { ContactInfoSkeleton } from "@/components/dashboard/contact/info/ContactInfoSkeleton";

export default function Loading() {
    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
            <ContactInfoSkeleton />
        </div>
    );
}
