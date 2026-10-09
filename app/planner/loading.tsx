import PlannerSkeleton from "@/components/planner/PlannerSkeleton";

export default function Loading() {
    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            <PlannerSkeleton />
        </div>
    );
}
