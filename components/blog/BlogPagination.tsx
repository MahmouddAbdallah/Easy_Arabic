import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";

/** 1 … 4 5 [6] 7 8 … 20: the current page, its neighbours, and the ends. */
export function pageWindow(current: number, total: number): Array<number | "gap"> {
    const pages = new Set([1, total, current - 1, current, current + 1]);
    const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
    return sorted.flatMap((page, index) => (index > 0 && page - sorted[index - 1] > 1 ? ["gap" as const, page] : [page]));
}

interface BlogPaginationProps {
    page: number;
    totalPages: number;
    href: (page: number) => string;
}

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-brand/50";
const step = cn(
    "inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:border-brand/50 hover:bg-brand-soft hover:text-brand motion-reduce:transition-none",
    focusRing
);
const numeral = "inline-flex h-10 min-w-10 items-center justify-center rounded-lg px-2 text-sm font-medium tabular-nums transition-colors motion-reduce:transition-none";

/**
 * Newer / older at the two ends, the page numbers between them (a short "Page 2 of 5" on a phone).
 * Plain links (not buttons), so every page of the blog is reachable and indexable without JavaScript.
 */
export function BlogPagination({ page, totalPages, href }: BlogPaginationProps) {
    if (totalPages <= 1) return null;

    return (
        <nav aria-label="Pagination" className="mt-16 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-border pt-8 md:mt-20">
            <div className="justify-self-start">
                {page > 1 && (
                    <Link href={href(page - 1)} rel="prev" className={step}>
                        <ChevronLeft aria-hidden className="size-4 rtl:rotate-180" />
                        Newer
                    </Link>
                )}
            </div>

            <div>
                <p className="text-sm text-muted-foreground sm:hidden">
                    Page {page} of {totalPages}
                </p>
                <ul role="list" className="hidden items-center gap-1 sm:flex">
                    {pageWindow(page, totalPages).map((entry, index) =>
                        entry === "gap" ? (
                            <li key={`gap-${index}`} aria-hidden className="px-1 text-muted-foreground">
                                …
                            </li>
                        ) : (
                            <li key={entry}>
                                <Link
                                    href={href(entry)}
                                    aria-current={entry === page ? "page" : undefined}
                                    aria-label={`Page ${entry}`}
                                    className={cn(numeral, focusRing, entry === page ? "bg-brand text-brand-foreground" : "text-foreground hover:bg-muted")}
                                >
                                    {entry}
                                </Link>
                            </li>
                        )
                    )}
                </ul>
            </div>

            <div className="justify-self-end">
                {page < totalPages && (
                    <Link href={href(page + 1)} rel="next" className={step}>
                        Older
                        <ChevronRight aria-hidden className="size-4 rtl:rotate-180" />
                    </Link>
                )}
            </div>
        </nav>
    );
}
