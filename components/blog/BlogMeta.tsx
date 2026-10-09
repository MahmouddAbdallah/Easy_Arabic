import { CalendarDays, Clock } from "lucide-react";
import { cn } from 'cn'
import { formatPublicDate, formatReadingTime, initialOf } from "./lib/format";

interface BlogMetaProps {
    authorName: string;
    /** ISO date to show (the publish date, or the last edit for a preview). */
    date: string | null;
    readingTime: number;
    className?: string;
}

/**
 * The byline: author on one side, date and reading time on the other, framed by two hairlines. The
 * short gold segment sitting on the top rule is the page's one accent (it echoes the active-link
 * marker in the site's navigation). Everything uses logical properties, so it mirrors for Arabic.
 */
export function BlogMeta({ authorName, date, readingTime, className }: BlogMetaProps) {
    return (
        <div className={cn("relative flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-y border-border py-4 text-sm text-muted-foreground", className)}>
            <span aria-hidden className="absolute inset-s-0 -top-px h-0.5 w-14 rounded-full bg-gold" />

            <span className="inline-flex min-w-0 items-center gap-3">
                <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft font-display text-lg font-bold text-brand ring-1 ring-brand/15"
                >
                    {initialOf(authorName)}
                </span>
                <span dir="auto" className="truncate text-base font-semibold text-foreground">
                    {authorName}
                </span>
            </span>

            <span className="inline-flex flex-wrap items-center gap-x-5 gap-y-1.5">
                {date && (
                    <span className="inline-flex items-center gap-1.5">
                        <CalendarDays aria-hidden className="size-4" />
                        <time dateTime={date}>{formatPublicDate(date)}</time>
                    </span>
                )}

                <span className="inline-flex items-center gap-1.5">
                    <Clock aria-hidden className="size-4" />
                    {/* Isolated: a digit-first English string would otherwise read "min read 7" inside an RTL article. */}
                    <bdi dir="ltr">{formatReadingTime(readingTime)}</bdi>
                </span>
            </span>
        </div>
    );
}
