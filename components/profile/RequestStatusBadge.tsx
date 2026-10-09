import { Ban, CheckCircle2, Clock, XCircle, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from 'cn';
import type { RequestStatus } from '@/lib/profile/service';

const STATUS: Record<RequestStatus, { label: string; icon: LucideIcon; className: string }> = {
    PENDING: { label: 'Awaiting review', icon: Clock, className: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400' },
    APPROVED: { label: 'Approved', icon: CheckCircle2, className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
    REJECTED: { label: 'Not approved', icon: XCircle, className: 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400' },
    CANCELLED: { label: 'Withdrawn', icon: Ban, className: 'border-border bg-muted text-muted-foreground' },
};

/** Status pill shared by the customer's Profile page and the admin review queue. */
export function RequestStatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
    const { label, icon: Icon, className: tone } = STATUS[status];
    return (
        <Badge variant="outline" className={cn('gap-1.5', tone, className)}>
            <Icon aria-hidden="true" />
            {label}
        </Badge>
    );
}
