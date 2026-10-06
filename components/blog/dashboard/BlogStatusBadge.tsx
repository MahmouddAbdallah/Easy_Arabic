import { cn } from "@/lib/utils";
import type { BlogStatus } from "@/components/blog/lib/types";

/** Draft / Published. Colour is never the only signal: the label is always there. */
export function BlogStatusBadge({ status, className }: { status: BlogStatus; className?: string }) {
    const published = status === "published";
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                published ? "bg-brand-soft text-brand" : "bg-muted text-muted-foreground",
                className
            )}
        >
            <span aria-hidden className={cn("size-1.5 rounded-full", published ? "bg-brand" : "bg-muted-foreground/60")} />
            {published ? "Published" : "Draft"}
        </span>
    );
}
