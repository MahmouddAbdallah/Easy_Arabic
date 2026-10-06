import { CalendarDays, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPublicDate, formatReadingTime, initialOf } from "./lib/format";

interface BlogMetaProps {
    authorName: string;
    /** ISO date to show (the publish date, or the last edit for a preview). */
    date: string | null;
    readingTime: number;
    className?: string;
}

/** Author, date and reading time, laid out as separate items rather than one run-on string. */
export function BlogMeta({ authorName, date, readingTime, className }: BlogMetaProps) {
    return (
        <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground", className)}>
            <span className="inline-flex items-center gap-2.5">
                <span
                    aria-hidden
                    className="flex size-8 items-center justify-center rounded-full bg-brand-soft font-display text-base font-bold text-brand"
                >
                    {initialOf(authorName)}
                </span>
                <span className="font-medium text-foreground">{authorName}</span>
            </span>

            {date && (
                <span className="inline-flex items-center gap-1.5">
                    <CalendarDays aria-hidden className="size-4" />
                    <time dateTime={date}>{formatPublicDate(date)}</time>
                </span>
            )}

            <span className="inline-flex items-center gap-1.5">
                <Clock aria-hidden className="size-4" />
                {formatReadingTime(readingTime)}
            </span>
        </div>
    );
}
