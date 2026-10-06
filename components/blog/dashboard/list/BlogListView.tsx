"use client";

import { useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, FilePlus2, Plus, RotateCw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BlogSummary } from "@/components/blog/lib/types";
import { DeleteBlogDialog } from "../dialogs/DeleteBlogDialog";
import type { useBlogList } from "../hooks/useBlogList";
import { BlogRow } from "./BlogRow";
import { BlogToolbar } from "./BlogToolbar";

type BlogListState = ReturnType<typeof useBlogList>;

interface BlogListViewProps {
    list: BlogListState;
    onOpen: (blogId: string) => void;
    onNew: () => void;
}

function SkeletonRows() {
    return (
        <ul aria-hidden className="divide-y divide-border">
            {Array.from({ length: 5 }, (_, index) => (
                <li key={index} className="flex items-center gap-4 px-4 py-4">
                    <div className="hidden h-12 w-[4.5rem] animate-pulse rounded-md bg-muted sm:block" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-3/5 animate-pulse rounded bg-muted/70" />
                    </div>
                    <div className="hidden h-5 w-20 animate-pulse rounded-full bg-muted md:block" />
                </li>
            ))}
        </ul>
    );
}

/** The posts table: filters, rows, pagination, and every state in between (loading, error, empty). */
export function BlogListView({ list, onOpen, onNew }: BlogListViewProps) {
    const { query, isLoading, error } = list;
    const data = list.list;
    const [toDelete, setToDelete] = useState<BlogSummary | null>(null);

    const hasFilters = Boolean(query.search || query.category || query.status !== "all");
    const clearFilters = () => {
        list.setSearchInput("");
        list.setStatus("all");
        list.setCategory("");
    };

    const noPostsAtAll = data !== null && !hasFilters && data.counts.all === 0;
    const pagination = data?.pagination;
    const from = pagination && pagination.totalItems > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
    const to = pagination ? Math.min(pagination.page * pagination.pageSize, pagination.totalItems) : 0;

    return (
        <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Blog</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Write, edit and publish posts.</p>
                </div>
                <Button onClick={onNew} className="bg-brand text-brand-foreground hover:bg-brand/90">
                    <Plus aria-hidden />
                    New post
                </Button>
            </header>

            {data?.truncated && (
                <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-foreground">
                    Only the most recently edited posts are listed. Older posts still exist and stay live.
                </p>
            )}

            <section aria-label="Posts" aria-busy={isLoading} className="overflow-hidden rounded-xl border border-border bg-card">
                {!noPostsAtAll && (
                    <BlogToolbar
                        searchInput={list.searchInput}
                        onSearchChange={list.setSearchInput}
                        status={query.status}
                        onStatusChange={list.setStatus}
                        counts={data?.counts ?? { all: 0, draft: 0, published: 0 }}
                        category={query.category}
                        onCategoryChange={list.setCategory}
                        categories={data?.categories ?? []}
                    />
                )}

                {error && data === null ? (
                    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                        <AlertTriangle className="size-8 text-destructive" aria-hidden />
                        <p className="font-medium text-foreground">The posts couldn’t be loaded</p>
                        <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
                        <Button variant="outline" onClick={list.reload}>
                            <RotateCw aria-hidden />
                            Try again
                        </Button>
                    </div>
                ) : data === null ? (
                    <SkeletonRows />
                ) : noPostsAtAll ? (
                    <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
                        <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
                            <FilePlus2 className="size-6" aria-hidden />
                        </span>
                        <p className="text-lg font-semibold text-foreground">No posts yet</p>
                        <p className="max-w-sm text-sm text-muted-foreground">Start with a title. Images, video, code and callouts are all a click away in the editor.</p>
                        <Button onClick={onNew} className="mt-2 bg-brand text-brand-foreground hover:bg-brand/90">
                            <Plus aria-hidden />
                            Write your first post
                        </Button>
                    </div>
                ) : data.data.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                        <SearchX className="size-8 text-muted-foreground" aria-hidden />
                        <p className="font-medium text-foreground">No posts match your filters</p>
                        <Button variant="outline" onClick={clearFilters}>
                            Clear filters
                        </Button>
                    </div>
                ) : (
                    <ul className={isLoading ? "divide-y divide-border opacity-60 transition-opacity" : "divide-y divide-border transition-opacity"}>
                        {data.data.map((blog) => (
                            <BlogRow key={blog.id} blog={blog} onOpen={onOpen} onDelete={setToDelete} onChanged={list.reload} />
                        ))}
                    </ul>
                )}

                {error && data !== null && (
                    <p role="alert" className="border-t border-border bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
                        {error}
                    </p>
                )}

                {pagination && pagination.totalItems > 0 && (
                    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
                        <span aria-live="polite">
                            {from}–{to} of {pagination.totalItems}
                        </span>
                        <div className="flex gap-1.5">
                            <Button variant="outline" size="sm" disabled={!pagination.hasPreviousPage || isLoading} onClick={() => list.setPage(pagination.page - 1)}>
                                <ChevronLeft aria-hidden className="rtl:rotate-180" />
                                Previous
                            </Button>
                            <Button variant="outline" size="sm" disabled={!pagination.hasNextPage || isLoading} onClick={() => list.setPage(pagination.page + 1)}>
                                Next
                                <ChevronRight aria-hidden className="rtl:rotate-180" />
                            </Button>
                        </div>
                    </div>
                )}
            </section>

            {toDelete && (
                <DeleteBlogDialog
                    blog={toDelete}
                    open
                    onOpenChange={(open) => !open && setToDelete(null)}
                    onDeleted={() => {
                        setToDelete(null);
                        list.reload();
                    }}
                />
            )}
        </div>
    );
}
