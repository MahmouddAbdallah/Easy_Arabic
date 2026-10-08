"use client";

import { useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, CheckCheck, MessageSquareText, RotateCw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteCommentDialog, type DeleteCommentTarget } from "../dialogs/DeleteCommentDialog";
import { useCommentList } from "../hooks/useCommentList";
import { CommentCard } from "./CommentCard";
import { CommentToolbar } from "./CommentToolbar";

function SkeletonRows() {
    return (
        <ul aria-hidden className="divide-y divide-border">
            {Array.from({ length: 3 }, (_, index) => (
                <li key={index} className="flex items-start gap-3 px-5 py-5">
                    <div className="size-9 animate-pulse rounded-full bg-muted" />
                    <div className="flex-1 space-y-2.5">
                        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-muted/70" />
                        <div className="h-3 w-4/5 animate-pulse rounded bg-muted/70" />
                    </div>
                </li>
            ))}
        </ul>
    );
}

/**
 * Comment moderation: what readers sent, waiting for review (the default tab), what is published, and
 * the replies under it. Approve to publish, reject or delete to remove, reply as the site.
 */
export function CommentsManager() {
    const list = useCommentList();
    const { query, isLoading, error } = list;
    const data = list.list;
    const [toDelete, setToDelete] = useState<DeleteCommentTarget | null>(null);

    const searching = Boolean(query.search);
    const pagination = data?.pagination;
    const from = pagination && pagination.total > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
    const to = pagination ? Math.min(pagination.page * pagination.pageSize, pagination.total) : 0;
    const noCommentsAtAll = data !== null && data.counts.all === 0;

    return (
        <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Comments</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Readers’ comments stay hidden until you approve them. Approve to publish, reject to discard, or reply as the site.
                </p>
            </header>

            {data?.truncated && (
                <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-foreground">
                    Only the most recent comments are listed. Older ones are still on their posts.
                </p>
            )}

            <section aria-label="Comments" aria-busy={isLoading} className="overflow-hidden rounded-xl border border-border bg-card">
                {!noCommentsAtAll && (
                    <CommentToolbar
                        searchInput={list.searchInput}
                        onSearchChange={list.setSearchInput}
                        status={query.status}
                        onStatusChange={list.setStatus}
                        counts={data?.counts ?? { pending: 0, approved: 0, all: 0 }}
                    />
                )}

                {error && data === null ? (
                    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                        <AlertTriangle className="size-8 text-destructive" aria-hidden />
                        <p className="font-medium text-foreground">The comments couldn’t be loaded</p>
                        <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
                        <Button variant="outline" onClick={list.reload}>
                            <RotateCw aria-hidden />
                            Try again
                        </Button>
                    </div>
                ) : data === null ? (
                    <SkeletonRows />
                ) : noCommentsAtAll ? (
                    <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
                        <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
                            <MessageSquareText className="size-6" aria-hidden />
                        </span>
                        <p className="text-lg font-semibold text-foreground">No comments yet</p>
                        <p className="max-w-sm text-sm text-muted-foreground">
                            Readers can comment on every published post. New comments will show up here, waiting for your review.
                        </p>
                    </div>
                ) : data.comments.length === 0 ? (
                    searching ? (
                        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                            <SearchX className="size-8 text-muted-foreground" aria-hidden />
                            <p className="font-medium text-foreground">No comments match your search</p>
                            <Button variant="outline" onClick={() => list.setSearchInput("")}>
                                Clear search
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                            <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
                                <CheckCheck className="size-6" aria-hidden />
                            </span>
                            <p className="text-lg font-semibold text-foreground">
                                {query.status === "pending" ? "You’re all caught up" : "Nothing here yet"}
                            </p>
                            <p className="max-w-sm text-sm text-muted-foreground">
                                {query.status === "pending" ? "No comments are waiting for review." : "No comments in this view."}
                            </p>
                        </div>
                    )
                ) : (
                    <ul className={isLoading ? "divide-y divide-border opacity-60 transition-opacity" : "divide-y divide-border transition-opacity"}>
                        {data.comments.map((comment) => (
                            <CommentCard key={comment.id} comment={comment} onChanged={list.reload} onDelete={setToDelete} />
                        ))}
                    </ul>
                )}

                {error && data !== null && (
                    <p role="alert" className="border-t border-border bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
                        {error}
                    </p>
                )}

                {pagination && pagination.total > 0 && (
                    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
                        <span aria-live="polite">
                            {from}–{to} of {pagination.total}
                        </span>
                        <div className="flex gap-1.5">
                            <Button variant="outline" size="sm" disabled={pagination.page <= 1 || isLoading} onClick={() => list.setPage(pagination.page - 1)}>
                                <ChevronLeft aria-hidden className="rtl:rotate-180" />
                                Previous
                            </Button>
                            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.pageCount || isLoading} onClick={() => list.setPage(pagination.page + 1)}>
                                Next
                                <ChevronRight aria-hidden className="rtl:rotate-180" />
                            </Button>
                        </div>
                    </div>
                )}
            </section>

            {toDelete && (
                <DeleteCommentDialog
                    target={toDelete}
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
