"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from 'cn'
import type { CommentCounts, CommentStatusFilter } from "@/components/blog/lib/comment-types";

const TABS: Array<{ value: CommentStatusFilter; label: string }> = [
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Published" },
    { value: "all", label: "All" },
];

interface CommentToolbarProps {
    searchInput: string;
    onSearchChange: (value: string) => void;
    status: CommentStatusFilter;
    onStatusChange: (status: CommentStatusFilter) => void;
    counts: CommentCounts;
}

export function CommentToolbar({ searchInput, onSearchChange, status, onStatusChange, counts }: CommentToolbarProps) {
    return (
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
            <div role="group" aria-label="Filter by status" className="flex w-fit rounded-lg border border-border bg-muted/50 p-0.5">
                {TABS.map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        aria-pressed={status === tab.value}
                        onClick={() => onStatusChange(tab.value)}
                        className={cn(
                            "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none",
                            status === tab.value ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {tab.label}
                        <span
                            className={cn(
                                "text-xs tabular-nums",
                                tab.value === "pending" && counts.pending > 0
                                    ? "rounded-full bg-amber-500/20 px-1.5 font-semibold text-amber-700 dark:text-amber-400"
                                    : "text-muted-foreground"
                            )}
                        >
                            {counts[tab.value]}
                        </span>
                    </button>
                ))}
            </div>

            <div className="relative flex-1 lg:max-w-sm">
                <Search aria-hidden className="pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    type="search"
                    value={searchInput}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Search name, email, comment or post…"
                    aria-label="Search comments"
                    className="h-8 ps-8 pe-8"
                />
                {searchInput && (
                    <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => onSearchChange("")}
                        className="absolute inset-e-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                        <X className="size-3.5" aria-hidden />
                    </button>
                )}
            </div>
        </div>
    );
}
