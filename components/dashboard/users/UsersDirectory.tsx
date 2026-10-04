import { GraduationCapIcon, UsersRoundIcon } from 'lucide-react'
import { getUsers } from '@/lib/data/users'
import UsersTable from './UsersTable'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

const PAGE_SIZE = 10

// The only things that differ between the Families and Teachers directories.
const DIRECTORIES = {
    family: {
        icon: UsersRoundIcon,
        title: 'Families Directory',
        description: 'Manage and view all registered families in the system.',
        singular: 'family',
        plural: 'families',
    },
    teacher: {
        icon: GraduationCapIcon,
        title: 'Teachers Directory',
        description: 'Manage and view all registered teachers in the system.',
        singular: 'teacher',
        plural: 'teachers',
    },
} as const

/**
 * One directory page for both roles, so Families and Teachers can't drift apart:
 * header, search, table and pagination are the same, only the role differs.
 */
const UsersDirectory = async ({ role, searchParams }: { role: 'family' | 'teacher'; searchParams: SearchParams }) => {
    const params = await searchParams
    const { icon: Icon, title, description, singular, plural } = DIRECTORIES[role]

    const page = Math.max(parseInt(typeof params.page === 'string' ? params.page : '1', 10) || 1, 1)
    const keyword = typeof params.keyword === 'string' ? params.keyword.trim() : ''

    const { data, count } = await getUsers<string>({
        filter: {
            where: [{ key: 'role', value: role }],
            skip: (page - 1) * PAGE_SIZE,
            limit: PAGE_SIZE,
            ...(keyword && { keyword, items: ['email', 'name', 'phone'] }),
            // A stable order, so rows can't repeat or go missing between pages.
            orderBy: { createdAt: 'desc', id: 'asc' },
        },
    })

    const total = count ?? 0

    return (
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col justify-between gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                    <div className="shrink-0 rounded-xl border border-brand/20 bg-brand-soft p-2.5 text-brand">
                        <Icon className="size-5" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
                    </div>
                </div>

                <div className="self-start rounded-full border border-brand/20 bg-brand-soft px-3.5 py-1.5 text-xs font-semibold text-brand tabular-nums sm:self-auto">
                    {total} {total === 1 ? singular : plural}
                </div>
            </div>

            <UsersTable data={data ?? []} count={total} role={role} pageSize={PAGE_SIZE} />
        </div>
    )
}

export default UsersDirectory
