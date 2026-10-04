import { Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LessonsFilter } from '@/components/lesson/LessonsFilter';
import Link from 'next/link';
import { getLessons } from "@/lib/data/lessons";
import LessonsTable from "@/components/lesson/LessonsTable";
import { authorization } from "@/lib/verifyAuth";
import { redirect } from "next/navigation";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function LessonsPage({ searchParams }: { searchParams: SearchParams }) {

    const { user } = await authorization()
    if (!user) {
        return redirect('/sign-in')
    }
    const params = await searchParams;

    // Pagination
    const page = parseInt((params.page as string) || "1", 10);
    const limit = 20;
    const skip = (page - 1) * limit;

    // Extract search query values safely
    const status = params.status as string | undefined;
    const teacherReward = params.teacherReward as string | undefined;
    const duration = params.duration as string | undefined;
    const dateFrom = params.dateFrom as string | undefined;
    const dateTo = params.dateTo as string | undefined;
    const familyId = params.familyId as string | undefined;

    const where = [
        { key: user.role == 'teacher' ? 'teacherId' : 'familyId', value: user.id },
        status && { key: 'status', value: status },
        teacherReward && { key: 'TeacherReward', value: teacherReward },
        duration && { key: 'duration', value: duration },
        dateFrom && { key: 'classDate', value: new Date(dateFrom).toISOString(), operator: 'gte' as const },
        dateTo && { key: 'classDate', value: new Date(dateTo).toISOString(), operator: 'lte' as const },
        familyId && { key: 'familyId', value: familyId },
    ].filter((item) => Boolean(item));

    const { data, count } = await getLessons({
        filter: {
            skip,
            limit,
            where: where as any,
            select: ['id', 'TeacherReward', 'classDate', 'duration', 'status', 'student'],
            include: {
                select: ['id', 'name', 'email'],
                value: user.role == 'family' ? 'teacher' : 'family'
            },
            orderBy: { 'createdAt': "desc" }
        }
    });


    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <BookOpen className="h-6 w-6 text-primary" />
                        <span>Lessons Management</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        Overview, track, and filter all scheduled and completed lessons.
                    </p>
                </div>
                {user.role != 'family'
                    && <Link href={'/lesson/new-lesson'}>
                        <Button size="sm" className="h-9 text-xs font-semibold gap-2 rounded-md shadow-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-all self-start sm:self-auto">
                            <Plus className="h-4 w-4" />
                            <span>New Lesson</span>
                        </Button>
                    </Link>
                }
            </div>
            <LessonsFilter />
            <LessonsTable
                role={user.role == 'teacher' ? 'teacher' : "family"}
                count={count}
                data={data}
            />
        </div>
    );
}