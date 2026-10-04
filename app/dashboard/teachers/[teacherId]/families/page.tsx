import TeacherFamilyList from '@/components/dashboard/teacher-family/TeacherFamilyList';
import { toLinks } from '@/components/dashboard/teacher-family/config';
import { getFamiliesOfTeacher } from '@/lib/data/users';

const page = async ({ params }: {
    params: Promise<{ teacherId: string }>,
}) => {
    const { teacherId } = await params;

    const { data } = await getFamiliesOfTeacher<string>({
        filter: {
            where: [
                {
                    key: "teacherId",
                    value: teacherId
                }
            ],
            select: ['id', 'createdAt'],
            include: {
                value: 'family',
                select: ['id', 'name', 'email', 'phone', 'status']
            },
            orderBy: { createdAt: 'desc' }
        }
    });

    return (
        <TeacherFamilyList
            key={teacherId}
            side="teacher"
            ownerId={teacherId}
            initialLinks={toLinks('teacher', data)}
        />
    )
}

export default page
