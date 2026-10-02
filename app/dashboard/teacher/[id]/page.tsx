import { getLessons } from "@/lib/data/lessons";
import LessonsTable from "@/components/lesson/LessonsTable";
import { TabsContent } from "@/components/ui/tabs";
import { LessonsDashboardFilter } from '@/components/dashboard/lessons/LessonsDashboardFilter';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

async function LessonsPage({ params, searchParams }: {
    searchParams: SearchParams,
    params: Promise<{ id: string }>
}) {
    const search = await searchParams;
    const { id } = await params;

    // Pagination
    const page = parseInt((search.page as string) || "1", 10);
    const limit = 20;
    const skip = (page - 1) * limit;

    // Extract search query values safely
    const status = search.status as string | undefined;
    const teacherReward = search.teacherReward as string | undefined;
    const duration = search.duration as string | undefined;
    const dateFrom = search.dateFrom as string | undefined;
    const dateTo = search.dateTo as string | undefined;
    const familyId = search.familyId as string | undefined;

    const where = [
        { key: 'teacherId', value: id },
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
                value: 'family'
            },
            orderBy: { 'createdAt': "desc" }
        }
    });

    return (
        <TabsContent value="lessons" className="space-y-4">
            <div className="space-y-6 max-w-7xl mx-auto">
                <LessonsDashboardFilter />
                <LessonsTable
                    count={count}
                    data={data}
                />
            </div>
        </TabsContent>
    )
}

export default LessonsPage