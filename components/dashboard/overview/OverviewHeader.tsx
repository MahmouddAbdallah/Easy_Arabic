import { LayoutDashboard } from 'lucide-react'

/** Same header pattern as the Families / Teachers directories, so the dashboard reads as one product. */
export default function OverviewHeader({ name }: { name: string }) {
    const firstName = name.trim().split(/\s+/)[0] || name

    return (
        <div className="flex flex-col justify-between gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
                <div className="shrink-0 rounded-xl border border-brand/20 bg-brand-soft p-2.5 text-brand">
                    <LayoutDashboard className="size-5" />
                </div>
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Overview</h1>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        Welcome back, {firstName}. Here&apos;s where Easy Arabic stands today.
                    </p>
                </div>
            </div>
        </div>
    )
}
