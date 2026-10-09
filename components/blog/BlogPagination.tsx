import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from 'cn'

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

/** Plain links (not buttons), so every page of the blog is reachable and indexable without JavaScript. */
export function BlogPagination({ page, totalPages, href }: BlogPaginationProps) {
    if (totalPages <= 1) return null;

    const base = "inline-flex h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors";
    return (
        <nav aria-label="Pagination" className="mt-12 flex flex-wrap items-center justify-center gap-1.5">
            {page > 1 ? (
                <Link href={href(page - 1)} rel="prev" className={cn(base, "gap-1 text-foreground hover:bg-muted")}>
                    <ChevronLeft aria-hidden className="size-4" />
                    Newer
                </Link>
            ) : null}

            {pageWindow(page, totalPages).map((entry, index) =>
                entry === "gap" ? (
                    <span key={`gap-${index}`} aria-hidden className="px-1 text-muted-foreground">
                        …
                    </span>
                ) : (
                    <Link
                        key={entry}
                        href={href(entry)}
                        aria-current={entry === page ? "page" : undefined}
                        aria-label={`Page ${entry}`}
                        className={cn(base, entry === page ? "bg-brand text-brand-foreground" : "text-foreground hover:bg-muted")}
                    >
                        {entry}
                    </Link>
                )
            )}

            {page < totalPages ? (
                <Link href={href(page + 1)} rel="next" className={cn(base, "gap-1 text-foreground hover:bg-muted")}>
                    Older
                    <ChevronRight aria-hidden className="size-4" />
                </Link>
            ) : null}
        </nav>
    );
}
