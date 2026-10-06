"use client";

import { ArrowLeft, ExternalLink, Eye, Loader2, Pencil, Send, Trash2, Undo2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { blogPostPath } from "@/components/blog/lib/constants";
import type { BlogStatus } from "@/components/blog/lib/types";
import { cn } from "@/lib/utils";
import { BlogStatusBadge } from "../BlogStatusBadge";
import type { EditorAction } from "../hooks/useBlogEditor";

export type EditorView = "write" | "preview";

interface EditorHeaderProps {
    status: BlogStatus;
    slug: string;
    isDirty: boolean;
    busy: EditorAction | null;
    view: EditorView;
    onViewChange: (view: EditorView) => void;
    onBack: () => void;
    onSave: () => void;
    onPublish: () => void;
    onUnpublish: () => void;
    onDelete: () => void;
}

/** The screen's action bar. Fixed at 3.5rem tall: the formatting toolbar sticks right below it. */
export function EditorHeader({ status, slug, isDirty, busy, view, onViewChange, onBack, onSave, onPublish, onUnpublish, onDelete }: EditorHeaderProps) {
    const published = status === "published";
    const working = busy !== null;

    return (
        <div className="sticky top-16 z-20 border-b border-border bg-card/90 backdrop-blur-md">
            <div className="mx-auto flex h-14 max-w-[88rem] items-center gap-2 px-4 sm:px-6 lg:px-8">
                <Button type="button" variant="ghost" size="sm" onClick={onBack} aria-label="Back to all posts">
                    <ArrowLeft aria-hidden className="rtl:rotate-180" />
                    <span className="hidden sm:inline">All posts</span>
                </Button>

                <BlogStatusBadge status={status} />
                <span aria-live="polite" className="hidden text-xs text-muted-foreground md:inline">
                    {busy ? "Saving…" : isDirty ? "Unsaved changes" : "All changes saved"}
                </span>

                <div className="ms-auto flex items-center gap-1.5">
                    <div role="group" aria-label="Editor view" className="me-1 flex rounded-lg border border-border bg-muted/50 p-0.5">
                        {(["write", "preview"] as const).map((option) => (
                            <button
                                key={option}
                                type="button"
                                aria-pressed={view === option}
                                onClick={() => onViewChange(option)}
                                className={cn(
                                    "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none",
                                    view === option ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {option === "write" ? <Pencil className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
                                <span className="hidden sm:inline">{option === "write" ? "Write" : "Preview"}</span>
                                <span className="sr-only sm:hidden">{option === "write" ? "Write" : "Preview"}</span>
                            </button>
                        ))}
                    </div>

                    {published && (
                        <a
                            href={blogPostPath(slug)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="View the live post (opens in a new tab)"
                            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}
                        >
                            <ExternalLink aria-hidden />
                            View
                        </a>
                    )}

                    <Button type="button" variant="ghost" size="icon-sm" onClick={onDelete} disabled={working} aria-label="Delete post">
                        <Trash2 aria-hidden />
                    </Button>

                    {published ? (
                        <>
                            <Button type="button" variant="outline" size="sm" onClick={onUnpublish} disabled={working}>
                                {busy === "unpublish" ? <Loader2 className="animate-spin" aria-hidden /> : <Undo2 aria-hidden />}
                                <span className="hidden md:inline">Unpublish</span>
                            </Button>
                            <Button type="button" size="sm" onClick={onSave} disabled={working || !isDirty} className="bg-brand text-brand-foreground hover:bg-brand/90">
                                {busy === "save" && <Loader2 className="animate-spin" aria-hidden />}
                                Update
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button type="button" variant="outline" size="sm" onClick={onSave} disabled={working || !isDirty}>
                                {busy === "save" && <Loader2 className="animate-spin" aria-hidden />}
                                <span className="hidden sm:inline">Save draft</span>
                                <span className="sm:hidden">Save</span>
                            </Button>
                            <Button type="button" size="sm" onClick={onPublish} disabled={working} className="bg-brand text-brand-foreground hover:bg-brand/90">
                                {busy === "publish" ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
                                Publish
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
