import TeacherFamiliesList from '@/components/dashboard/teachers/TeacherFamiliesList';
import { getFamiliesOfTeacher } from '@/lib/data/users';


const page = async ({ params }: {
    params: Promise<{ teacherId: string }>,
}) => {
    const { teacherId } = await params;

    const { data } = await getFamiliesOfTeacher({
        filter: {
            where: [
                {
                    key: "teacherId",
                    value: teacherId
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
        <TeacherFamiliesList students={data} />
    )
}

export default page