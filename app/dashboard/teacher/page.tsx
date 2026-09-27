import UsersTable from '@/components/dashboard/users/UsersTable';
import { getUsers } from '@/lib/data/users'

const Page = async () => {
    const { data, count, } = await getUsers({
        filter: {
            where: [
                {
                    key: 'role',
                    value: 'teacher'
                }
            ]
        }
    });

    return (
        <div className="p-6 md:p-10 space-y-6 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Teachers Directory
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage and view all registered teachers in the system.
                    </p>
                </div>

                {/* Counter Badge */}
                <div className="self-start sm:self-auto bg-primary/10 text-primary border border-primary/20 px-3.5 py-1.5 rounded-full text-xs font-semibold">
                    Total: {data?.length || 0}
                </div>
            </div>

            {/* Reusable Users Table */}
            <UsersTable
                data={data || []}
                count={count}
            />
        </div>
    )
}

export default Page