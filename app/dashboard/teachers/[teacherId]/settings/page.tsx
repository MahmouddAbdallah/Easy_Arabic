import UserSettings from '@/components/dashboard/users/UserSettings'

const page = async ({ params }: {
    params: Promise<{ teacherId: string }>,
}) => {
    const { teacherId } = await params

    return <UserSettings kind="teacher" userId={teacherId} />
}

export default page
