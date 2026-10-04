import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/** Up to two initials for an avatar fallback: "Amina Yusuf" → "AY". */
export function getInitials(name?: string | null) {
    const letters = (name ?? '')
        .trim()
        .split(/\s+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    return letters || '?'
}

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
    active: {
        badge: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        dot: 'bg-emerald-500',
    },
    suspended: {
        badge: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        dot: 'bg-amber-500',
    },
    banned: {
        badge: 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400',
        dot: 'bg-rose-500',
    },
}

const FALLBACK_STYLE = {
    badge: 'border-border bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground/60',
}

/** Account status pill used by every user list in the dashboard. */
export function UserStatusBadge({ status, className }: { status?: string | null; className?: string }) {
    if (!status) return null
    const style = STATUS_STYLES[status] ?? FALLBACK_STYLE
    return (
        <Badge variant="outline" className={cn('gap-1.5 capitalize', style.badge, className)}>
            <span aria-hidden="true" className={cn('size-1.5 rounded-full', style.dot)} />
            {status}
        </Badge>
    )
}
