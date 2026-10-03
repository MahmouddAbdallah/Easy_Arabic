import { Skeleton } from '@/components/ui/skeleton';

/** Mirrors the editor layout (header, tab bar, one section card) so nothing jumps on load. */
export function ContactInfoSkeleton() {
    return (
        <div className="space-y-6" role="status" aria-label="Loading contact page settings">
            <div className="space-y-2 border-b border-border/40 pb-4">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-4 w-full max-w-md" />
            </div>

            <div className="flex gap-2 overflow-hidden border-b border-border/50 pb-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-28 shrink-0" />
                ))}
            </div>

            <div className="rounded-2xl border border-border/60 bg-card">
                <div className="space-y-2 border-b border-border/50 px-4 py-4 sm:px-6">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-72 max-w-full" />
                </div>
                <div className="grid grid-cols-1 gap-4 px-4 py-6 sm:grid-cols-2 sm:px-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className={i < 2 ? 'space-y-2 sm:col-span-2' : 'space-y-2'}>
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    ))}
                </div>
                <div className="flex justify-end gap-2 border-t border-border/50 px-4 py-3 sm:px-6">
                    <Skeleton className="h-7 w-20" />
                    <Skeleton className="h-7 w-28" />
                </div>
            </div>
        </div>
    );
}
