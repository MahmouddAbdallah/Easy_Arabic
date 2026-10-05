import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
    return (
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8" role="status" aria-label="Loading profile requests">
            <div className="space-y-2 border-b border-border/40 pb-4">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-full max-w-md" />
            </div>
            <div className="flex gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-24 rounded-full" />
                ))}
            </div>
            <Card className="gap-0 divide-y py-0 shadow-sm">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <Skeleton className="size-9 shrink-0 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-3.5 w-56" />
                        </div>
                        <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                ))}
            </Card>
            <span className="sr-only">Loading profile requests…</span>
        </div>
    );
}
