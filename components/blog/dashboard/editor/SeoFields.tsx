"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BLOG_LIMITS, blogPostPath } from "@/components/blog/lib/constants";
import type { BlogSeo } from "@/components/blog/lib/types";
import { cn } from 'cn'

interface SeoFieldsProps {
    value: BlogSeo;
    onChange: (value: BlogSeo) => void;
    /** What the page falls back to when a field is empty, shown in the search preview. */
    fallbackTitle: string;
    fallbackDescription: string;
    slug: string;
    errors: Record<string, string[]>;
}

function Counter({ length, max }: { length: number; max: number }) {
    return <span className={cn("text-xs tabular-nums", length > max ? "text-destructive" : "text-muted-foreground")}>{length}/{max}</span>;
}

export function SeoFields({ value, onChange, fallbackTitle, fallbackDescription, slug, errors }: SeoFieldsProps) {
    const title = value.title || fallbackTitle;
    const description = value.description || fallbackDescription;

    return (
        <div className="grid gap-4">
            {/* How the post may look in search results, using the same fallbacks the public page uses. */}
            <div aria-label="Search result preview" className="rounded-lg border border-border bg-background p-3">
                <p className="line-clamp-2 break-all text-xs text-muted-foreground"                >
                    {blogPostPath(slug || "…")}
                </p>
                <p dir="auto" className="mt-0.5 line-clamp-1 text-base font-medium text-brand">
                    {title || "Untitled post"}
                </p>
                <p dir="auto" className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {description || "No description yet. Search engines will choose a snippet from the post."}
                </p>
            </div>

            <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                    <Label htmlFor="blog-seo-title">SEO title</Label>
                    <Counter length={value.title.length} max={BLOG_LIMITS.seoTitle} />
                </div>
                <Input
                    id="blog-seo-title"
                    value={value.title}
                    onChange={(event) => onChange({ ...value, title: event.target.value })}
                    placeholder={fallbackTitle || "Defaults to the post title"}
                    aria-invalid={errors.seo?.length ? true : undefined}
                />
            </div>

            <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                    <Label htmlFor="blog-seo-description">Meta description</Label>
                    <Counter length={value.description.length} max={BLOG_LIMITS.seoDescription} />
                </div>
                <Textarea
                    id="blog-seo-description"
                    value={value.description}
                    rows={3}
                    onChange={(event) => onChange({ ...value, description: event.target.value })}
                    placeholder="Defaults to the excerpt"
                />
            </div>

            <div className="grid gap-1.5">
                <Label htmlFor="blog-seo-canonical">Canonical URL</Label>
                <Input
                    id="blog-seo-canonical"
                    type="url"
                    value={value.canonicalUrl}
                    onChange={(event) => onChange({ ...value, canonicalUrl: event.target.value })}
                    placeholder="Only if this post first appeared elsewhere"
                    dir="ltr"
                />
            </div>

            <label className="flex items-start gap-2.5 text-sm">
                <input
                    type="checkbox"
                    checked={value.noIndex}
                    onChange={(event) => onChange({ ...value, noIndex: event.target.checked })}
                    className="mt-0.5 size-4 accent-[var(--brand)]"
                />
                <span>
                    Hide from search engines
                    <span className="block text-xs text-muted-foreground">The post stays public to anyone with the link.</span>
                </span>
            </label>
            {errors.seo?.[0] && (
                <p role="alert" className="text-xs text-destructive">
                    {errors.seo[0]}
                </p>
            )}
        </div>
    );
}
