'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SearchIcon, SearchXIcon, XIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAppContext } from '@/components/AppContext'
import AddLinksDialog from './AddLinksDialog'
import LinkRow from './LinkRow'
import { LINK_SIDES, type LinkSide, type TeacherFamilyLink } from './config'

interface TeacherFamilyListProps {
    side: LinkSide
    /** Id of the teacher (side="teacher") or family (side="family") whose page this is. */
    ownerId: string
    /** Links as loaded by the server page. */
    initialLinks: TeacherFamilyLink[]
}

/**
 * The assignments card shared by /dashboard/teachers/[id]/families and
 * /dashboard/families/[id]/teachers. The server page owns the data; this keeps a
 * local copy so adds and removes show instantly, then refreshes the route so the
 * counts in the page header stay correct.
 */
const TeacherFamilyList = ({ side, ownerId, initialLinks }: TeacherFamilyListProps) => {
    const config = LINK_SIDES[side]
    const Icon = config.icon
    const router = useRouter()
    const { user } = useAppContext()
    // The API only lets admins change links, so only admins get the controls.
    const canManage = user?.role === 'admin'

    const [links, setLinks] = useState(initialLinks)
    const [query, setQuery] = useState('')

    // Take the server's copy again whenever the route refreshes with new data.
    const [syncedFrom, setSyncedFrom] = useState(initialLinks)
    if (syncedFrom !== initialLinks) {
        setSyncedFrom(initialLinks)
        setLinks(initialLinks)
    }

    const linkedIds = useMemo(() => new Set(links.map((link) => link.user.id)), [links])

    const visibleLinks = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return links
        return links.filter(({ user: u }) => `${u.name} ${u.email} ${u.phone ?? ''}`.toLowerCase().includes(q))
    }, [links, query])

    const handleAdded = (added: TeacherFamilyLink[]) => {
        setLinks((prev) => [...added, ...prev])
        router.refresh()
    }

    const handleRemoved = (linkId: string) => {
        setLinks((prev) => prev.filter((link) => link.id !== linkId))
        router.refresh()
    }

    return (
        <Card className="gap-0 overflow-hidden border-border/60 py-0 shadow-sm">
            <CardHeader className="border-b border-border/40 bg-card p-4 sm:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="shrink-0 rounded-xl border border-brand/20 bg-brand-soft p-2.5 text-brand">
                            <Icon className="size-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-lg font-semibold tracking-tight">{config.title}</CardTitle>
                                <Badge variant="secondary" className="rounded-full px-2.5 font-mono tabular-nums">
                                    {links.length}
                                </Badge>
                            </div>
                            <CardDescription className="mt-0.5 text-xs">{config.description}</CardDescription>
                        </div>
                    </div>

                    <div className="flex w-full items-center gap-2.5 md:w-auto">
                        <div className="relative flex-1 md:w-64 md:flex-none">
                            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/70" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={config.searchPlaceholder}
                                aria-label={`Search assigned ${config.plural}`}
                                className="h-9 bg-muted/30 pl-9 text-xs transition-colors focus-visible:bg-background"
                            />
                        </div>
                        {canManage && (
                            <AddLinksDialog side={side} ownerId={ownerId} linkedIds={linkedIds} onAdded={handleAdded} />
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                {visibleLinks.length > 0 ? (
                    <ul className="divide-y divide-border/60">
                        {visibleLinks.map((link) => (
                            <LinkRow
                                key={link.id}
                                side={side}
                                ownerId={ownerId}
                                link={link}
                                canManage={canManage}
                                onRemoved={handleRemoved}
                            />
                        ))}
                    </ul>
                ) : links.length > 0 ? (
                    <EmptyState
                        icon={<SearchXIcon />}
                        title={`No ${config.plural} match “${query.trim()}”`}
                        hint="Try a different name, email or phone number."
                        action={
                            <Button variant="ghost" size="sm" className="mt-1 gap-1.5" onClick={() => setQuery('')}>
                                <XIcon />
                                Clear search
                            </Button>
                        }
                    />
                ) : (
                    <EmptyState
                        icon={<Icon />}
                        title={config.emptyTitle}
                        hint={canManage ? config.emptyHint : undefined}
                    />
                )}
            </CardContent>
        </Card>
    )
}

function EmptyState({
    icon,
    title,
    hint,
    action,
}: {
    icon: React.ReactNode
    title: string
    hint?: string
    action?: React.ReactNode
}) {
    return (
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <div className="rounded-full bg-muted p-3 text-muted-foreground [&_svg]:size-5">{icon}</div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            {action}
        </div>
    )
}

export default TeacherFamilyList
