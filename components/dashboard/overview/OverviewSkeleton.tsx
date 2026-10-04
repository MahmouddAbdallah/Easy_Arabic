import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const ROWS = [0, 1, 2, 3, 4]

/** Mirrors OverviewContent (stat tiles, lessons + inbox, quick links) so nothing jumps when data arrives. */
export default function OverviewSkeleton() {
    return (
        <div className="space-y-6" role="status" aria-label="Loading overview">
            <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                {ROWS.slice(0, 4).map((i) => (
                    <div key={i} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                        <div className="flex items-start justify-between gap-2">
                            <Skeleton className="h-3.5 w-20" />
                            <Skeleton className="size-4" />
                        </div>
                        <Skeleton className="mt-3 h-7 w-14" />
                        <Skeleton className="mt-2 h-3 w-24" />
                    </div>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {[
                    { span: 'lg:col-span-2', rows: 5 },
                    { span: '', rows: 5 },
                ].map(({ span, rows }, index) => (
                    <Card key={index} className={`border-border/60 ${span}`}>
                        <CardHeader>
                            <Skeleton className="h-5 w-36" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {ROWS.slice(0, rows).map((i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <Skeleton className="size-9 shrink-0 rounded-full" />
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <Skeleton className="h-4 w-1/2" />
                                        <Skeleton className="h-3 w-3/4" />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                {ROWS.slice(0, 4).map((i) => (
                    <Skeleton key={i} className="h-[74px] rounded-2xl" />
                ))}
            </div>
            <span className="sr-only">Loading overview…</span>
        </div>
    )
}
