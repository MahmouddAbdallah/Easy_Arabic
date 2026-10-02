import { TeachersDirectorySkeleton } from "@/components/dashboard/teachers/TeacherSkeletons";

export default function Loading() {
    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <TeachersDirectorySkeleton />
        </div>
    );
}
