import UserSettings from '@/components/dashboard/users/UserSettings'

const page = async ({ params }: {
    params: Promise<{ familyId: string }>,
}) => {
    const { familyId } = await params

    return <UserSettings kind="family" userId={familyId} />
}

export default page
