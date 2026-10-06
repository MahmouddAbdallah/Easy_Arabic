"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { BLOG_LIMITS, blogPostPath } from "@/components/blog/lib/constants";
import { getExcerpt, type BlogRecord } from "@/components/blog/lib/types";
import { cn } from "@/lib/utils";
import type { EditorFields } from "../hooks/useBlogEditor";
import { CoverImageField } from "./CoverImageField";
import { SeoFields } from "./SeoFields";
import { TagsInput } from "./TagsInput";

interface BlogSettingsPanelProps {
    blog: BlogRecord;
    fields: EditorFields;
    setField: <K extends keyof EditorFields>(key: K, value: EditorFields[K]) => void;
    regenerateSlug: () => void;
    fieldErrors: Record<string, string[]>;
    /** Categories and tags already used, offered as completions. */
    suggestions: { categories: string[]; tags: string[] };
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
    return (
        <section className="grid gap-3 rounded-xl border border-border bg-card p-4">
            <div>
                <h2 className="text-sm font-semibold text-foreground">{title}</h2>
                {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
            </div>
            {children}
        </section>
    );
}

function FieldError({ messages }: { messages?: string[] }) {
    return messages?.[0] ? (
        <p role="alert" className="text-xs text-destructive">
            {messages[0]}
        </p>
    ) : null;
}

/** Everything about the post except its title and body: address, excerpt, organisation, cover, SEO. */
export function BlogSettingsPanel({ blog, fields, setField, regenerateSlug, fieldErrors, suggestions }: BlogSettingsPanelProps) {
    const liveAddressChanged = blog.status === "published" && fields.slug !== blog.slug;

    return (
        <aside aria-label="Post settings" className="grid content-start gap-4">
            <Section title="Address" hint="The post's link on the site.">
                <div className="grid gap-1.5">
                    <Label htmlFor="blog-slug">URL slug</Label>
                    <Input
                        id="blog-slug"
                        dir="auto"
                        value={fields.slug}
                        maxLength={BLOG_LIMITS.slug}
                        onChange={(event) => setField("slug", event.target.value)}
                        aria-invalid={fieldErrors.slug?.length ? true : undefined}
                    />
                    <FieldError messages={fieldErrors.slug} />
                    <p dir="ltr" className="truncate text-xs text-muted-foreground">
                        {blogPostPath(fields.slug || "…")}
                    </p>
                    {liveAddressChanged && (
                        <p role="status" className="text-xs text-amber-700 dark:text-amber-400">
                            This post is live. Changing its address breaks links people already have.
                        </p>
                    )}
                    <Button type="button" variant="ghost" size="xs" className="w-fit" onClick={regenerateSlug}>
                        Reset from title
                    </Button>
                </div>
            </Section>

            <Section title="Excerpt" hint="A short teaser for lists and link previews. Leave empty to use the start of the post.">
                <Textarea
                    aria-label="Excerpt"
                    value={fields.excerpt}
                    rows={3}
                    maxLength={BLOG_LIMITS.excerpt}
                    onChange={(event) => setField("excerpt", event.target.value)}
                    placeholder={blog.autoExcerpt || "Summarise the post in a sentence or two"}
                    dir="auto"
                />
                <p className={cn("text-end text-xs tabular-nums", fields.excerpt.length > BLOG_LIMITS.excerpt ? "text-destructive" : "text-muted-foreground")}>
                    {fields.excerpt.length}/{BLOG_LIMITS.excerpt}
                </p>
            </Section>

            <Section title="Organise">
                <div className="grid gap-1.5">
                    <Label htmlFor="blog-category">Category</Label>
                    <Input
                        id="blog-category"
                        list="blog-category-options"
                        value={fields.category}
                        maxLength={BLOG_LIMITS.category}
                        onChange={(event) => setField("category", event.target.value)}
                        placeholder="e.g. Grammar"
                    />
                    <datalist id="blog-category-options">
                        {suggestions.categories.map((category) => (
                            <option key={category} value={category} />
                        ))}
                    </datalist>
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="blog-tags">Tags</Label>
                    <TagsInput id="blog-tags" value={fields.tags} onChange={(tags) => setField("tags", tags)} suggestions={suggestions.tags} />
                </div>
            </Section>

            <Section title="Cover image" hint="Shown on cards, above the article, and when the post is shared.">
                <CoverImageField blogId={blog.id} value={fields.coverImage} onChange={(cover) => setField("coverImage", cover)} error={fieldErrors.coverImage?.[0]} />
            </Section>

            <Section title="Search and sharing" hint="Optional. Leave blank to use the title and excerpt.">
                <SeoFields
                    value={fields.seo}
                    onChange={(seo) => setField("seo", seo)}
                    fallbackTitle={fields.title}
                    fallbackDescription={getExcerpt({ excerpt: fields.excerpt, autoExcerpt: blog.autoExcerpt })}
                    slug={fields.slug}
                    errors={fieldErrors}
                />
            </Section>
        </aside>
    );
}
