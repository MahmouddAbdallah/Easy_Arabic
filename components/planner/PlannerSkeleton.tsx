import { Skeleton } from '@/components/ui/skeleton'

/** Shown while a planner route streams in (dashboard planner pages, which sit under a layout that already has its own header). */
const PlannerSkeleton = () => (
    <div className="space-y-6" aria-busy="true" aria-label="Loading planner">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Skeleton className="col-span-2 h-24 rounded-xl md:col-span-1" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-9 w-56 rounded-lg" />
        <Skeleton className="h-130 w-full rounded-xl" />
    </div>
)

export default PlannerSkeleton
