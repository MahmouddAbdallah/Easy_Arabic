import UsersTable from '@/components/dashboard/users/UsersTable';
import { getUsers } from '@/lib/data/users'
import { UsersRoundIcon } from 'lucide-react';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const Page = async ({ searchParams }: { searchParams: SearchParams }) => {
    const params = await searchParams;

    // Pagination
    const page = parseInt((params.page as string) || "1", 10);
    const limit = 10;
    const skip = (page - 1) * limit;

    //search
    const keyword = params.keyword as string;

    const { data, count, } = await getUsers({
        filter: {
            where: [
                {
                    key: 'role',
                    value: 'family'
                }
            ],
            skip,
            limit,
            ...(keyword && { keyword }),
            ...(keyword && { items: ['email', 'name', 'phone'] }),
        }
    });

    return (
        <div className="p-6 md:p-10 space-y-6 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
                <div className="flex items-center gap-3">
                    <div className="shrink-0 p-2.5 rounded-xl bg-brand-soft text-brand border border-brand/20">
                        <UsersRoundIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Families Directory
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Manage and view all registered Families in the system.
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