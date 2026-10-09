"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { BlogStatusFilter } from "@/components/blog/lib/types";
import { cn } from 'cn'

const TABS: Array<{ value: BlogStatusFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "published", label: "Published" },
    { value: "draft", label: "Drafts" },
];

interface BlogToolbarProps {
    searchInput: string;
    onSearchChange: (value: string) => void;
    status: BlogStatusFilter;
    onStatusChange: (status: BlogStatusFilter) => void;
    counts: Record<BlogStatusFilter, number>;
    category: string;
    onCategoryChange: (category: string) => void;
    categories: string[];
}

export function BlogToolbar({ searchInput, onSearchChange, status, onStatusChange, counts, category, onCategoryChange, categories }: BlogToolbarProps) {
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
                        <span className="text-xs tabular-nums text-muted-foreground">{counts[tab.value]}</span>
                    </button>
                ))}
            </div>

            <div className="flex flex-1 flex-col gap-2 sm:flex-row lg:max-w-xl lg:justify-end">
                {categories.length > 0 && (
                    <select
                        aria-label="Filter by category"
                        value={category}
                        onChange={(event) => onCategoryChange(event.target.value)}
                        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-44"
                    >
                        <option value="">All categories</option>
                        {categories.map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                )}

                <div className="relative flex-1">
                    <Search aria-hidden className="pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="search"
                        value={searchInput}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Search title, tag or category…"
                        aria-label="Search posts"
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
        </div>
    );
}
