import { TeacherLessonsSkeleton } from "@/components/dashboard/teachers/TeacherSkeletons";

// Covers the lessons section only: the profile header and nav live in the
// layout and stream behind their own skeleton, so they stay put on tab switches.
export default function Loading() {
    return <TeacherLessonsSkeleton />;
}
