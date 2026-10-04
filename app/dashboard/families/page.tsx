import UsersDirectory from '@/components/dashboard/users/UsersDirectory'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const Page = ({ searchParams }: { searchParams: SearchParams }) => (
    <UsersDirectory role="family" searchParams={searchParams} />
)

export default Page
