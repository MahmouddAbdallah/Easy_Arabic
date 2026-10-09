'use client';

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUpdateQuery } from "@/hooks/useUpdateQuery";
import { useSearchParams } from 'next/navigation';
import { cn } from 'cn'

interface PaginationPageProps {
  totalPages?: number | null;
  totalRecords?: number;
  pageSize?: number;
  variant?: 'page' | 'table';
  count?: number;
}

const PaginationPage = ({
  totalPages,
  totalRecords,
  pageSize = 10,
  variant = 'page',
  count
}: PaginationPageProps) => {
  const searchParams = useSearchParams();
  const page = Number(searchParams.get('page') || 1);
  const { updateQuery } = useUpdateQuery();

  const records = totalRecords ?? count ?? 0;
  const calculatedTotalPages = Math.ceil(records / pageSize) || 1;
  const total = totalPages || calculatedTotalPages;

  // 1. Table Variant (Ultra Luxury Finish)
  if (variant === 'table') {
    const startRecord = records === 0 ? 0 : Math.min((page - 1) * pageSize + 1, records);
    const endRecord = Math.min(page * pageSize, records);

    return (
      <div className="flex flex-row items-center justify-between md:gap-4 px-3 md:px-6 py-3.5 bg-background/60 backdrop-blur-md border-t border-border/40 text-xs text-muted-foreground select-none">
        {/* Info Text */}
        <div className="flex items-center gap-1.5 font-medium tracking-wide">
          <span className="hidden md:block">Showing</span>
          <span className="font-semibold text-foreground px-1.5 py-0.5 rounded-md bg-muted/50 border border-border/30">
            {startRecord}–{endRecord}
          </span>
          <span>of</span>
          <span className="font-semibold text-foreground px-1.5 py-0.5 rounded-md bg-muted/50 border border-border/30">
            {records}
          </span>
          <span className="hidden md:block">results</span>
        </div>

        {/* Controls */}
        <div className="flex items-center md:gap-3">
          <div className="text-xs font-semibold px-3 py-1 rounded-full bg-muted/40 border border-border/30 text-foreground">
            Page {page} <span className="text-muted-foreground font-normal">of {total}</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => updateQuery('page', `${Math.max(page - 1, 1)}`)}
              disabled={page <= 1}
              className="h-8 w-8 rounded-lg border-border/50 bg-background/50 hover:bg-accent hover:text-accent-foreground active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => updateQuery('page', `${Math.min(page + 1, total)}`)}
              disabled={page >= total}
              className="h-8 w-8 rounded-lg border-border/50 bg-background/50 hover:bg-accent hover:text-accent-foreground active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Default Page Variant (Clean & Premium Floating Style)
  const paginationNumbers = () => {
    const pages: (number | string)[] = [];
    if (!total) return pages;

    pages.push(1);
    const start = Math.max(page - 1, 2);
    const end = Math.min(page + 1, total - 1);

    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (end < total - 1) pages.push('...');
    if (total > 1) pages.push(total);

    return pages;
  };

  const pagesToShow = paginationNumbers();

  return (
    <Pagination className="my-6">
      <PaginationContent className="gap-1.5 bg-background/80 backdrop-blur-md p-1.5 rounded-2xl border border-border/40 shadow-sm">
        <PaginationItem>
          <PaginationPrevious
            className={cn(
              "cursor-pointer rounded-xl transition-all duration-200 hover:bg-accent hover:text-accent-foreground active:scale-95",
              page <= 1 && "pointer-events-none opacity-40"
            )}
            onClick={() => updateQuery('page', `${Math.max(page - 1, 1)}`)}
          />
        </PaginationItem>

        {pagesToShow.map((p, idx) => (
          <PaginationItem key={idx}>
            {typeof p === 'number' ? (
              <PaginationLink
                className={cn(
                  "cursor-pointer rounded-xl font-medium transition-all duration-200 h-9 w-9 flex items-center justify-center text-sm",
                  page === p
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90 hover:text-primary-foreground font-semibold scale-105"
                    : "hover:bg-accent hover:text-accent-foreground active:scale-95"
                )}
                isActive={page === p}
                onClick={() => updateQuery('page', `${p}`)}
              >
                {p}
              </PaginationLink>
            ) : (
              <PaginationEllipsis className="text-muted-foreground/60" />
            )}
          </PaginationItem>
        ))}

        <PaginationItem>
          <PaginationNext
            className={cn(
              "cursor-pointer rounded-xl transition-all duration-200 hover:bg-accent hover:text-accent-foreground active:scale-95",
              page >= total && "pointer-events-none opacity-40"
            )}
            onClick={() => updateQuery('page', `${Math.min(page + 1, total)}`)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
};

export default PaginationPage;