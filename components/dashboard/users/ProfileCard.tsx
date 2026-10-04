import type { ReactNode } from 'react'
import { Award, MailIcon, PhoneIcon, type LucideIcon } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { UserStatusBadge } from './userDisplay'

interface ProfileCardProps {
    name?: string | null
    /** Short line under the name, e.g. "Quran Teacher". */
    roleLabel: string
    email?: string | null
    phone?: string | null
    status?: string | null
    icon?: LucideIcon
    /** Optional control on the right, e.g. the teacher's rate badge. */
    action?: ReactNode
}

/**
 * Identity block at the top of a teacher or family page. The brand band uses the
 * same language as the Home WelcomeBanner.
 */
const ProfileCard = ({ name, roleLabel, email, phone, status, icon: RoleIcon = Award, action }: ProfileCardProps) => (
    <Card className="gap-0 overflow-hidden border-border/60 py-0">
        <div className="relative h-20 bg-brand-deep sm:h-24" aria-hidden="true">
            <div
                className="pointer-events-none absolute inset-0 pattern-khatam text-white opacity-[0.06]"
                style={{ ['--pattern-size' as string]: '49px' }}
            />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gold/40" />
        </div>

        <div className="flex flex-col gap-4 px-5 pt-2 pb-5 sm:flex-row sm:items-end sm:gap-5 sm:px-6 sm:pb-6">
            <Avatar className="-mt-10 size-20 shrink-0 shadow-sm ring-4 ring-card sm:-mt-12 sm:size-24">
                <AvatarFallback className="bg-brand-soft text-xl font-bold text-brand sm:text-2xl">
                    {name?.slice(0, 2)}
                </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 space-y-2">
                <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">{name}</h1>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                        <RoleIcon className="size-4 text-brand" />
                        {roleLabel}
                    </p>
                    <UserStatusBadge status={status} />
                </div>

                {(email || phone) && (
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                        {email && (
                            <a
                                href={`mailto:${email}`}
                                className="flex min-w-0 items-center gap-1.5 transition-colors hover:text-foreground"
                            >
                                <MailIcon className="size-3.5 shrink-0" />
                                <span className="truncate">{email}</span>
                            </a>
                        )}
                        {phone && (
                            <a
                                href={`tel:${phone}`}
                                className="flex items-center gap-1.5 font-mono text-xs transition-colors hover:text-foreground"
                            >
                                <PhoneIcon className="size-3.5 shrink-0" />
                                {phone}
                            </a>
                        )}
                    </div>
                )}
            </div>

            {action && <div className="sm:shrink-0">{action}</div>}
        </div>
    </Card>
)

/** Same footprint as ProfileCard, for streaming fallbacks. */
export const ProfileCardSkeleton = () => (
    <Card className="gap-0 overflow-hidden border-border/60 py-0">
        <Skeleton className="h-20 rounded-none sm:h-24" />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:gap-5 sm:px-6 sm:pb-6">
            <Skeleton className="-mt-10 size-20 shrink-0 rounded-full ring-4 ring-card sm:-mt-12 sm:size-24" />
            <div className="min-w-0 flex-1 space-y-2.5">
                <Skeleton className="h-7 w-48 max-w-full" />
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-44" />
                </div>
            </div>
        </div>
    </Card>
)

export default ProfileCard
