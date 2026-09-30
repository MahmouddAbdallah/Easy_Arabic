import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const ROWS = [
    ["w-28", "w-2/3"],
    ["w-36", "w-1/2"],
    ["w-24", "w-3/4"],
    ["w-32", "w-3/5"],
    ["w-28", "w-2/3"],
    ["w-36", "w-1/2"],
    ["w-24", "w-3/4"],
    ["w-32", "w-3/5"],
];

/** Mirrors the real layout (header, toolbar, rows) so nothing jumps when data arrives. */
export function ContactsSkeleton() {
    return (
        <div className="space-y-6" role="status" aria-label="Loading messages">
            <div className="space-y-2 border-b border-border/40 pb-4">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-full max-w-md" />
            </div>

            <Card className="gap-0 py-0 shadow-sm">
                <div className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
                    <Skeleton className="h-9 w-full lg:max-w-md" />
                    <Skeleton className="h-9 w-full lg:w-56" />
                </div>
                <div className="divide-y border-t">
                    {ROWS.map(([name, text], index) => (
                        <div key={index} className="flex items-start gap-3 px-4 py-3 md:items-center md:gap-4">
                            <Skeleton className="size-9 shrink-0 rounded-full" />
                            <div className="min-w-0 flex-1 space-y-2 md:grid md:grid-cols-[13rem_minmax(0,1fr)_6rem] md:items-center md:gap-4 md:space-y-0">
                                <Skeleton className={`h-4 ${name}`} />
                                <Skeleton className={`h-4 ${text}`} />
                                <Skeleton className="hidden h-3.5 w-14 justify-self-end md:block" />
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
            <span className="sr-only">Loading messages…</span>
        </div>
    );
}
