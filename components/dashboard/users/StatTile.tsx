import type { LucideIcon } from 'lucide-react'

import { cn } from 'cn'

interface StatTileProps {
    icon: LucideIcon
    label: string
    value: string
    hint?: string
    className?: string
}

const StatTile = ({ icon: Icon, label, value, hint, className }: StatTileProps) => (
    <div className={cn('rounded-xl bg-card p-4 ring-1 ring-foreground/10', className)}>
        <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium leading-tight text-muted-foreground">{label}</p>
            <Icon className="h-4 w-4 shrink-0 text-brand" />
        </div>
        <p className="mt-2 truncate text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground/80">{hint}</p>}
    </div>
)

export default StatTile