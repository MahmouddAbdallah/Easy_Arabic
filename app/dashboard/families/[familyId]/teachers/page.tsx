import TeacherFamilyList from '@/components/dashboard/teacher-family/TeacherFamilyList';
import { toLinks } from '@/components/dashboard/teacher-family/config';
import { getTeachersOfFamily } from '@/lib/data/users';

const page = async ({ params }: {
    params: Promise<{ familyId: string }>,
}) => {
    const { familyId } = await params;

    const { data } = await getTeachersOfFamily<string>({
        filter: {
            where: [
                {
                    key: "familyId",
                    value: familyId
                }
            ],
            select: ['id', 'createdAt'],
            include: {
                value: 'teacher',
                select: ['id', 'name', 'email', 'phone', 'status', 'subject']
            },
            orderBy: { createdAt: 'desc' }
        }
    });

    return (
        <TeacherFamilyList
            key={familyId}
            side="family"
            ownerId={familyId}
            initialLinks={toLinks('family', data)}
        />
    )
}

export default page
