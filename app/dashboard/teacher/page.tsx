import { Users } from 'lucide-react';
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
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
                <div className="flex items-center gap-3">
                    <div className="shrink-0 p-2.5 rounded-xl bg-brand-soft text-brand border border-brand/20">
                        <Users className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Teachers Directory
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Manage and view all registered teachers in the system.
                        </p>
                    </div>
                </div>

                {/* Counter Badge */}
                <div className="self-start sm:self-auto bg-brand-soft text-brand border border-brand/20 px-3.5 py-1.5 rounded-full text-xs font-semibold tabular-nums">
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