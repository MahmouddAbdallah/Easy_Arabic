import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

/* Skeletons mirror the real layouts (same cards, grids and breakpoints) so
   nothing jumps when data arrives. They use the base Skeleton's gentle pulse
   only: no shimmer sweeps. */

const Status = ({ label }: { label: string }) => <span className="sr-only">{label}</span>

/** Profile card + stat tiles + section nav (TeacherDetailsHeader). */
export function TeacherDetailsHeaderSkeleton() {
    return (
        <section className="space-y-6" role="status" aria-label="Loading teacher profile">
            <Card className="gap-0 overflow-hidden border-border/60 py-0">
                <Skeleton className="h-20 rounded-none sm:h-24" />
                <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:gap-5 sm:px-6 sm:pb-6">
                    <Skeleton className="-mt-10 h-20 w-20 shrink-0 rounded-full ring-4 ring-card sm:-mt-12 sm:h-24 sm:w-24" />
                    <div className="min-w-0 flex-1 space-y-2.5">
                        <Skeleton className="h-7 w-48 max-w-full" />
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-44" />
                        </div>
                    </div>
                    <Skeleton className="h-7 w-32 rounded-full" />
                </div>
            </Card>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div
                        key={i}
                        className={`rounded-xl bg-card p-4 ring-1 ring-foreground/10 ${i === 4 ? 'col-span-2 sm:col-span-1' : ''}`}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <Skeleton className="h-3.5 w-20" />
                            <Skeleton className="h-4 w-4 rounded" />
                        </div>
                        <Skeleton className="mt-3 h-7 w-14" />
                        <Skeleton className="mt-2 h-3 w-16" />
                    </div>
                ))}
            </div>

            <div className="flex gap-1 border-b border-border/60">
                <div className="flex flex-1 justify-center px-4 py-3 sm:flex-none">
                    <Skeleton className="h-5 w-28" />
                </div>
                <div className="flex flex-1 justify-center px-4 py-3 sm:flex-none">
                    <Skeleton className="h-5 w-28" />
                </div>
            </div>
            <Status label="Loading teacher profile…" />
        </section>
    )
}

/** Filter bar + lessons table card (teacher/[id]). */
export function TeacherLessonsSkeleton() {
    return (
        <div className="space-y-6" role="status" aria-label="Loading lessons">
            <Card className="gap-0 border-border/60 py-0">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <Skeleton className="h-9 w-full sm:w-40" />
                    <Skeleton className="h-9 w-full sm:w-40" />
                    <Skeleton className="h-9 w-full sm:w-40" />
                    <Skeleton className="h-9 w-full sm:ml-auto sm:w-28" />
                </div>
            </Card>

            <Card className="gap-0 overflow-hidden border-border/60 py-0">
                <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-4 sm:px-6">
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-3.5 w-64 max-w-full" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <div className="divide-y divide-border/50">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3.5 sm:px-6">
                            <Skeleton className="size-8 shrink-0 rounded-md" />
                            <div className="min-w-0 flex-1 space-y-2 md:grid md:flex-none md:w-full md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_7rem_7rem_6rem_6rem_4rem] md:items-center md:gap-4 md:space-y-0">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-4 w-24 md:block" />
                                <Skeleton className="hidden h-5 w-20 rounded-full md:block" />
                                <Skeleton className="hidden h-5 w-20 rounded-md md:block" />
                                <Skeleton className="hidden h-4 w-16 md:block" />
                                <Skeleton className="hidden h-4 w-20 md:block" />
                                <Skeleton className="hidden h-7 w-14 justify-self-end md:block" />
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
            <Status label="Loading lessons…" />
        </div>
    )
}

/** Enrolled families card (teacher/[id]/students). */
export function TeacherFamiliesSkeleton() {
    return (
        <Card className="gap-0 overflow-hidden border-border/60 py-0" role="status" aria-label="Loading students">
            <div className="flex flex-col gap-4 border-b border-border/40 p-4 sm:p-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <Skeleton className="size-10 shrink-0 rounded-xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-3.5 w-56 max-w-full" />
                    </div>
                </div>
                <div className="flex w-full items-center gap-2.5 md:w-auto">
                    <Skeleton className="h-9 flex-1 md:w-60 md:flex-none" />
                    <Skeleton className="h-9 w-10 sm:w-32" />
                </div>
            </div>
            <div className="divide-y divide-border/60">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
                        <div className="flex min-w-0 items-center gap-3">
                            <Skeleton className="size-10 shrink-0 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3.5 w-44 max-w-full" />
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                            <Skeleton className="h-5 w-16 rounded-full" />
                            <Skeleton className="size-8 rounded-md" />
                        </div>
                    </div>
                ))}
            </div>
            <Status label="Loading students…" />
        </Card>
    )
}

/** Teachers directory (teacher/page.tsx): header, toolbar, table. */
export function TeachersDirectorySkeleton() {
    return (
        <div className="space-y-6" role="status" aria-label="Loading teachers">
            <div className="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <Skeleton className="size-11 shrink-0 rounded-xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-7 w-48" />
                        <Skeleton className="h-4 w-72 max-w-full" />
                    </div>
                </div>
                <Skeleton className="h-7 w-20 rounded-full" />
            </div>

            <Card className="gap-0 border-border/80 py-0 shadow-sm">
                <div className="p-3.5">
                    <Skeleton className="h-9 w-full sm:w-80" />
                </div>
            </Card>

            <Card className="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
                <div className="hidden bg-muted/50 px-4 py-3 md:block">
                    <Skeleton className="h-4 w-full max-w-xl" />
                </div>
                <div className="divide-y divide-border/60">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                            <Skeleton className="size-10 shrink-0 rounded-full" />
                            <div className="min-w-0 flex-1 space-y-2 md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_6rem_6rem_7rem] md:items-center md:gap-4 md:space-y-0">
                                <Skeleton className="h-4 w-36" />
                                <Skeleton className="h-3.5 w-44 max-w-full" />
                                <Skeleton className="hidden h-5 w-16 rounded-full md:block" />
                                <Skeleton className="hidden h-5 w-16 rounded-full md:block" />
                                <Skeleton className="hidden h-4 w-20 md:block" />
                            </div>
                            <Skeleton className="size-8 shrink-0 rounded-md" />
                        </div>
                    ))}
                </div>
            </Card>
            <Status label="Loading teachers…" />
        </div>
    )
}
