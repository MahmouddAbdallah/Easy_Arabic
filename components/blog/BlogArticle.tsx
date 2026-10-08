import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { displayFont } from "@/lib/fonts";
import { BlogCard } from "./BlogCard";
import { BlogMeta } from "./BlogMeta";
import { BlogToc } from "./BlogToc";
import { BlogContent } from "./content/BlogContent";
import { BLOG_BASE_PATH, blogIndexPath } from "./lib/constants";
import { extractHeadings } from "./lib/content";
import { taxonomyKey } from "./lib/slug";
import { getExcerpt, type BlogArticleData, type BlogSummary } from "./lib/types";
import { textDirection } from "./lib/direction";
import { cloudinaryImageVariant, cloudinarySrcSet } from "./lib/url";

export interface BlogArticleProps {
    blog: BlogArticleData;
    /** "On this page" links for posts with enough headings. */
    showToc?: boolean;
    /** Cards shown under the post. */
    related?: BlogSummary[];
    /** The reader-comments section, placed inside the reading column under the post. The dashboard preview leaves it out. */
    comments?: ReactNode;
    /** Dashboard preview: nothing is a link, and the date is the last edit. */
    preview?: boolean;
    /** Where the blog is mounted; changes every link this article builds. */
    basePath?: string;
    className?: string;
}

/**
 * The cover keeps its own proportions, within limits: a very tall image is trimmed a little and a
 * very wide one too, so the cover never takes over the screen and is never badly cropped either.
 */
const COVER_RATIO = { min: 1.5, max: 2.2, fallback: 16 / 9 } as const;
const coverRatioOf = (cover: { width?: number; height?: number }) =>
    cover.width && cover.height ? Math.min(COVER_RATIO.max, Math.max(COVER_RATIO.min, cover.width / cover.height)) : COVER_RATIO.fallback;

/**
 * The article as a visitor reads it. Purely presentational (no data fetching), so the public page
 * (`<Blog />`) and the dashboard's live preview render the very same component.
 */
export function BlogArticle({ blog, showToc = true, related = [], comments, preview = false, basePath = BLOG_BASE_PATH, className }: BlogArticleProps) {
    const excerpt = getExcerpt(blog);
    const headings = showToc ? extractHeadings(blog.content) : [];
    const cover = blog.coverImage;
    const srcSet = cover ? cloudinarySrcSet(cover.url, [640, 960, 1280, 1600]) : undefined;

    return (
        <article className={cn(displayFont.variable, "pb-14 md:pb-16", className)}>
            <header className="mx-auto w-full max-w-7xl px-5 pt-8 pb-6 md:pt-12 md:pb-8">
                {!preview && (
                    <Link
                        href={basePath}
                        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
                        All posts
                    </Link>
                )}

                {blog.category &&
                    (preview ? (
                        <span className="mb-3 block w-fit rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand">{blog.category}</span>
                    ) : (
                        <Link
                            href={blogIndexPath({ category: taxonomyKey(blog.category) }, basePath)}
                            className="mb-3 block w-fit rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand transition-colors hover:bg-brand/15"
                        >
                            {blog.category}
                        </Link>
                    ))}

                <h1 dir={textDirection(blog.title) ?? "auto"} className="font-display text-[2rem] leading-[1.15] font-bold tracking-tight text-balance text-foreground sm:text-4xl md:text-[2.6rem] [&[dir=rtl]]:leading-[1.35]">
                    {blog.title}
                </h1>

                {excerpt && (
                    <p dir={textDirection(excerpt) ?? "auto"} className="mt-4 text-xl leading-[1.5] text-pretty text-muted-foreground md:text-[1.375rem] [&[dir=rtl]]:leading-[1.7]">
                        {excerpt}
                    </p>
                )}

                <BlogMeta className="mt-6" authorName={blog.author.name} date={blog.publishedAt ?? blog.updatedAt} readingTime={blog.readingTime} />

                {/* The one accent: a short gold rule, echoing the active-link marker in the site's navigation. */}
                <div aria-hidden className="mt-7 h-0.5 w-14 rounded-full bg-gold" />
            </header>

            {cover && (
                <figure className="mx-auto mb-8 w-full max-w-7xl px-5 md:mb-10">
                    <div
                        className="overflow-hidden rounded-xl bg-muted ring-1 ring-border md:rounded-2xl"
                        style={{ aspectRatio: coverRatioOf(cover) }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={cloudinaryImageVariant(cover.url, 1280)}
                            srcSet={srcSet}
                            sizes="(min-width: 768px) 728px, 100vw"
                            alt={cover.alt}
                            width={cover.width}
                            height={cover.height}
                            // The cover is the largest thing above the fold, so it must not wait for lazy-loading.
                            loading="eager"
                            fetchPriority="high"
                            decoding="async"
                            className="size-full object-cover"
                        />
                    </div>
                </figure>
            )}

            <div className="mx-auto w-full max-w-7xl px-5">
                <BlogToc headings={headings} />

                <BlogContent doc={blog.content} />

                {blog.tags.length > 0 && (
                    <footer className="mt-10 flex flex-wrap gap-2 border-t border-border pt-5">
                        {blog.tags.map((tag) =>
                            preview ? (
                                <span key={tag} className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">
                                    {tag}
                                </span>
                            ) : (
                                <Link
                                    key={tag}
                                    href={blogIndexPath({ tag: taxonomyKey(tag) }, basePath)}
                                    className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand"
                                >
                                    {tag}
                                </Link>
                            )
                        )}
                    </footer>
                )}

                {comments}
            </div>

            {related.length > 0 && (
                <section aria-labelledby="blog-related" className="mx-auto mt-16 w-full max-w-6xl px-5 md:mt-20 md:px-8">
                    <h2 id="blog-related" className="mb-6 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                        Keep reading
                    </h2>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {related.map((item) => (
                            <BlogCard key={item.id} blog={item} basePath={basePath} />
                        ))}
                    </div>
                </section>
            )}
        </article>
    );
}
