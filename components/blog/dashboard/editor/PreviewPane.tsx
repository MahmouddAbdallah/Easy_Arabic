"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { BlogArticle } from "@/components/blog/BlogArticle";
import { analyzeDocument, deriveExcerpt } from "@/components/blog/lib/content";
import type { BlogArticleData, BlogDoc, BlogRecord } from "@/components/blog/lib/types";
import type { EditorFields } from "../hooks/useBlogEditor";

interface PreviewPaneProps {
    blog: BlogRecord;
    fields: EditorFields;
    /** The body as it is right now (unsaved edits included), already validated. */
    doc: BlogDoc | null;
    /** Why a preview couldn't be built, e.g. an image with an invalid address. */
    error: string | null;
}

/**
 * The post as visitors will see it: the same <BlogArticle> the public page renders, fed with the
 * editor's current, unsaved values. Links are switched off so nothing here navigates away.
 */
export function PreviewPane({ blog, fields, doc, error }: PreviewPaneProps) {
    const data = useMemo<BlogArticleData | null>(() => {
        if (!doc) return null;
        const analysis = analyzeDocument(doc);
        return {
            title: fields.title.trim() || "Untitled post",
            slug: fields.slug,
            excerpt: fields.excerpt,
            autoExcerpt: deriveExcerpt(analysis.text),
            category: fields.category.trim() || null,
            tags: fields.tags,
            coverImage: fields.coverImage,
            author: blog.author,
            readingTime: analysis.readingTime,
            publishedAt: blog.publishedAt,
            updatedAt: blog.updatedAt,
            content: doc,
        };
    }, [doc, fields, blog.author, blog.publishedAt, blog.updatedAt]);

    if (error || !data) {
        return (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                <div>
                    <p className="font-medium text-foreground">The preview couldn’t be built</p>
                    <p className="mt-1 text-muted-foreground">{error ?? "Nothing to show yet."} Fix this in the editor before saving.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
            <p className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
                Preview of what visitors will see, including changes you haven’t saved.
            </p>
            <BlogArticle blog={data} preview showToc className="pb-10" />
        </div>
    );
}
