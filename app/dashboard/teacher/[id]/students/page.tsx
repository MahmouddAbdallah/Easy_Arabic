import TeacherFamiliesList from '@/components/dashboard/teachers/TeacherFamiliesList';
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
        <TeacherFamiliesList students={data} />
    )
}

export default page