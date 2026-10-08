import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getUser } from '@/lib/data/users'
import DeleteUserCard from './DeleteUserCard'
import ResetPasswordForm from './ResetPasswordForm'
import UserDetailsForm, { type SettingsUser } from './UserDetailsForm'

/**
 * Body of `/dashboard/{families,teachers}/[id]/settings`. One component for both roles, so the
 * two pages can't drift apart. (The profile header above it comes from the route's layout.)
 * The whole dashboard is admin-only, and each API route behind these forms checks that again.
 */
const UserSettings = async ({ kind, userId }: { kind: 'family' | 'teacher'; userId: string }) => {
    const { data } = await getUser(userId, ['id', 'name', 'email', 'phone', 'role', 'status'])
    const user = data as (SettingsUser & { role: string }) | null | undefined

    // A missing user, or a teacher opened under /families/ (and vice versa), has no settings page.
    if (!user || user.role !== kind) notFound()

    const settingsUser: SettingsUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone ?? '',
        status: user.status,
    }

    return (
        <div className="space-y-6">
            <UserDetailsForm user={settingsUser} />
            <ResetPasswordForm userId={settingsUser.id} />
            <DeleteUserCard kind={kind} user={settingsUser} />
        </div>
    )
}

const FieldSkeleton = () => (
    <div className="space-y-1.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-full" />
    </div>
)

/** Same cards and grids as UserSettings, for each route's loading.tsx. */
export const UserSettingsSkeleton = () => (
    <div className="space-y-6" role="status" aria-label="Loading settings">
        {[4, 2].map((fields, index) => (
            <Card key={index}>
                <CardHeader className="gap-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3.5 w-72 max-w-full" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        {Array.from({ length: fields }).map((_, i) => (
                            <FieldSkeleton key={i} />
                        ))}
                    </div>
                    <div className="flex sm:justify-end">
                        <Skeleton className="h-8 w-full sm:w-32" />
                    </div>
                </CardContent>
            </Card>
        ))}
        <Card className="ring-destructive/30">
            <CardHeader className="gap-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3.5 w-80 max-w-full" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-8 w-32" />
            </CardContent>
        </Card>
        <span className="sr-only">Loading settings…</span>
    </div>
)

export default UserSettings
