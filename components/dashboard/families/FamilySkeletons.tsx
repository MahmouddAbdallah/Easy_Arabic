import { ProfileCardSkeleton } from '@/components/dashboard/users/ProfileCard'
import { Skeleton } from '@/components/ui/skeleton'

/** Profile card + stat tiles + section nav (FamilyDetailsHeader), same grid and breakpoints. */
export function FamilyDetailsHeaderSkeleton() {
    return (
        <section className="space-y-6" role="status" aria-label="Loading family profile">
            <ProfileCardSkeleton />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                        <div className="flex items-start justify-between gap-2">
                            <Skeleton className="h-3.5 w-20" />
                            <Skeleton className="h-4 w-4 rounded" />
                        </div>
                        <Skeleton className="mt-3 h-7 w-14" />
                        <Skeleton className="mt-2 h-3 w-24" />
                    </div>
                ))}
            </div>

            <div className="w-full rounded-xl border border-border/60 bg-card p-1 sm:w-fit">
                <div className="flex gap-1">
                    <Skeleton className="h-9 flex-1 sm:w-32 sm:flex-none" />
                    <Skeleton className="h-9 flex-1 sm:w-32 sm:flex-none" />
                </div>
            </div>
            <span className="sr-only">Loading family profile…</span>
        </section>
    )
}
