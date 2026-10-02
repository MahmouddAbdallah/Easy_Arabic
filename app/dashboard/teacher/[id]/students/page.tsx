import TeacherFamiliesList from '@/components/dashboard/teachers/TeacherFamiliesList';
import { TabsContent } from '@/components/ui/tabs'
import { getFamiliesOfTeacher } from '@/lib/data/users';


const page = async ({ params }: {
    params: Promise<{ id: string }>,
}) => {
    const { id } = await params;

    const { data } = await getFamiliesOfTeacher({
        filter: {
            where: [
                {
                    key: "teacherId",
                    value: id
                }
            ],
            select: ['id'],
            include: {
                value: 'family',
                select: ['id', 'name', 'email', 'phone', 'status']
            }
        }
    });

    return (
        <TabsContent value="students" className="space-y-4">
            <TeacherFamiliesList students={data} />
        </TabsContent>
    )
}

export default page