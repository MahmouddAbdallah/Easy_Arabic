import { Lock, Pencil, ShieldCheck, Eye, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from 'cn';

export type FieldKind = 'editable' | 'locked' | 'admin' | 'readonly';

const KINDS: Record<FieldKind, { label: string; icon: LucideIcon; className: string }> = {
    editable: { label: 'Editable by you', icon: Pencil, className: 'border-brand/25 bg-brand-soft text-brand' },
    locked: { label: 'Needs admin approval', icon: Lock, className: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400' },
    admin: { label: 'Admin-controlled', icon: ShieldCheck, className: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400' },
    readonly: { label: 'Read-only', icon: Eye, className: 'border-border bg-muted text-muted-foreground' },
};

/** Tells the customer at a glance who controls a field. */
export function FieldBadge({ kind, className }: { kind: FieldKind; className?: string }) {
    const { label, icon: Icon, className: tone } = KINDS[kind];
    return (
        <Badge variant="outline" className={cn('gap-1', tone, className)}>
            <Icon aria-hidden="true" />
            {label}
        </Badge>
    );
}
