import Link from 'next/link'
import { PhoneIcon } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { UserStatusBadge, getInitials } from '../users/userDisplay'
import RemoveLinkDialog from './RemoveLinkDialog'
import { profileHref, type LinkSide, type TeacherFamilyLink } from './config'

interface LinkRowProps {
    side: LinkSide
    ownerId: string
    link: TeacherFamilyLink
    /** Only admins can change links; everyone else just sees the list. */
    canManage: boolean
    onRemoved: (linkId: string) => void
}

// UTC keeps server- and client-rendered text identical, whatever the viewer's timezone.
const formatAdded = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

const LinkRow = ({ side, ownerId, link, canManage, onRemoved }: LinkRowProps) => {
    const { user } = link
    const name = user.name || 'Unnamed'

    return (
        <li className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30 sm:px-6">
            <Link
                href={profileHref(side, user.id)}
                className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
                <Avatar size="lg" className="size-10 border">
                    <AvatarFallback className="bg-brand-soft font-medium text-brand">{getInitials(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground group-hover:underline">{name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email || 'No email'}</p>
                </div>
            </Link>

            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
                {user.phone && (
                    <span className="hidden items-center gap-1.5 font-mono text-xs text-muted-foreground lg:inline-flex">
                        <PhoneIcon className="size-3.5 text-brand/70" />
                        {user.phone}
                    </span>
                )}
                {user.subject && side === 'family' && (
                    <Badge variant="outline" className="hidden md:inline-flex">
                        {user.subject}
                    </Badge>
                )}
                {link.createdAt && (
                    <span className="hidden text-xs text-muted-foreground xl:block">Added {formatAdded(link.createdAt)}</span>
                )}
                <UserStatusBadge status={user.status} />
                {canManage && <RemoveLinkDialog side={side} ownerId={ownerId} link={link} onRemoved={onRemoved} />}
            </div>
        </li>
    )
}

export default LinkRow
