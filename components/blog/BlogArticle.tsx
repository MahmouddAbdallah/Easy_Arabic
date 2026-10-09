import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Tag } from "lucide-react";
import { cn } from 'cn'
import { displayFont } from "@/lib/fonts";
import { BlogCard } from "./BlogCard";
import { BlogMeta } from "./BlogMeta";
import { BlogToc } from "./BlogToc";
import { BlogContent } from "./content/BlogContent";
import { BLOG_BASE_PATH, TOC_MIN_HEADINGS, blogIndexPath } from "./lib/constants";
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
    /** The reader-comments section, placed under the post in the same column as the text. The dashboard preview leaves it out. */
    comments?: ReactNode;
    /** Dashboard preview: nothing is a link, the date is the last edit, and the table of contents stays inline (no sticky rail). */
    preview?: boolean;
    /** Where the blog is mounted; changes every link this article builds. */
    basePath?: string;
    className?: string;
}

/**
 * Widths. The text is one 42rem column (about 70 characters a line). On large screens a post with a
 * table of contents gets a 14rem rail beside it: 42rem + 4rem gap + 14rem = 60rem. Everything that
 * should line up (header, cover, body) is built on one of these two shells, so edges match.
 */
const GUTTER = "mx-auto w-full px-5 sm:px-8";
const COLUMN = "max-w-[46rem]"; // 42rem of text plus the side gutters
const WIDE = "lg:max-w-5xl"; // 60rem of content plus the side gutters
const MEASURE = "max-w-[42rem]";

/**
 * The cover keeps its own proportions, within limits: a very tall image is trimmed a little and a
 * very wide one too, so the cover never takes over the screen and is never badly cropped either.
 */
const COVER_RATIO = { min: 1.5, max: 2.2, fallback: 16 / 9 } as const;
const coverRatioOf = (cover: { width?: number; height?: number }) =>
    cover.width && cover.height ? Math.min(COVER_RATIO.max, Math.max(COVER_RATIO.min, cover.width / cover.height)) : COVER_RATIO.fallback;

const categoryPill = "block w-fit rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand";
const tagPill = "inline-flex h-10 items-center rounded-full border border-border bg-card px-4 text-sm text-muted-foreground sm:h-9 sm:px-3.5";
const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-brand/50";

/**
 * The article as a visitor reads it. Purely presentational (no data fetching), so the public page
 * (`<Blog />`) and the dashboard's live preview render the very same component.
 *
 * The whole article takes the direction of its title (so an Arabic post mirrors: byline, tags, comments,
 * and the rail swaps sides), while each block of the body still sets its own direction.
 */
export function BlogArticle({ blog, showToc = true, related = [], comments, preview = false, basePath = BLOG_BASE_PATH, className }: BlogArticleProps) {
    const excerpt = getExcerpt(blog);
    const headings = showToc ? extractHeadings(blog.content) : [];
    const hasToc = headings.length >= TOC_MIN_HEADINGS;
    // The rail is for the public page only: the dashboard preview is narrow and sits in a clipped box, where "sticky" can't work.
    const rail = hasToc && !preview;
    const direction = textDirection(blog.title) ?? (excerpt ? textDirection(excerpt) : null) ?? "ltr";
    const cover = blog.coverImage;
    const srcSet = cover ? cloudinarySrcSet(cover.url, [640, 960, 1280, 1600]) : undefined;

    return (
        <article dir={direction} className={cn(displayFont.variable, className)}>
            <header className={cn(GUTTER, COLUMN, rail && WIDE, "pt-8 pb-8 md:pt-12 md:pb-10")}>
                {(!preview || blog.category) && (
                    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
                        {!preview && (
                            <Link
                                href={basePath}
                                className={cn("-ms-2 inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none", focusRing)}
                            >
                                <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
                                All posts
                            </Link>
                        )}

                        {!preview && blog.category && <span aria-hidden className="h-4 w-px bg-border" />}

                        {blog.category &&
                            (preview ? (
                                <span className={categoryPill}>{blog.category}</span>
                            ) : (
                                <Link
                                    href={blogIndexPath({ category: taxonomyKey(blog.category) }, basePath)}
                                    className={cn(categoryPill, "transition-colors hover:bg-brand/15 motion-reduce:transition-none", focusRing)}
                                >
                                    {blog.category}
                                </Link>
                            ))}
                    </div>
                )}

                {/* Arabic joins its letters, so it gets no negative letter-spacing, and more leading than Latin. */}
                <h1
                    dir={textDirection(blog.title) ?? "auto"}
                    className="max-w-[46rem] font-display text-[2rem] leading-[1.12] font-bold tracking-tight text-balance wrap-break-word text-foreground sm:text-[2.5rem] md:text-[2.75rem] lg:text-5xl [&[dir=rtl]]:leading-[1.4] [&[dir=rtl]]:tracking-normal"
                >
                    {blog.title}
                </h1>

                {excerpt && (
                    <p
                        dir={textDirection(excerpt) ?? "auto"}
                        className={cn(MEASURE, "mt-5 text-lg leading-relaxed text-pretty text-muted-foreground md:text-xl [&[dir=rtl]]:leading-[1.85]")}
                    >
                        {excerpt}
                    </p>
                )}

                <BlogMeta className={cn(MEASURE, "mt-8")} authorName={blog.author.name} date={blog.publishedAt ?? blog.updatedAt} readingTime={blog.readingTime} />
            </header>

            {cover && (
                <figure className={cn(GUTTER, COLUMN, WIDE, "mb-10 md:mb-14")}>
                    <div
                        className="overflow-hidden rounded-xl bg-muted ring-1 ring-border md:rounded-2xl"
                        style={{ aspectRatio: coverRatioOf(cover) }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={cloudinaryImageVariant(cover.url, 1280)}
                            srcSet={srcSet}
                            sizes="(min-width: 1024px) 960px, 100vw"
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

            <div className={cn(GUTTER, COLUMN, rail && WIDE, "pb-14 md:pb-20")}>
                <div className={cn(rail && "lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-16")}>
                    <div className="min-w-0">
                        {/* Under the rail's breakpoint the table of contents is a collapsible card above the text. */}
                        {hasToc && <BlogToc headings={headings} className={rail ? "lg:hidden" : undefined} />}

                        <BlogContent doc={blog.content} />

                        {blog.tags.length > 0 && (
                            <footer className="mt-12 flex items-start gap-3 border-t border-border pt-6">
                                <Tag aria-hidden className="mt-2.5 size-4 shrink-0 text-muted-foreground sm:mt-2" />
                                <ul aria-label="Tags" className="flex flex-wrap gap-2">
                                    {blog.tags.map((tag) => (
                                        <li key={tag}>
                                            {preview ? (
                                                <span className={tagPill}>{tag}</span>
                                            ) : (
                                                <Link
                                                    href={blogIndexPath({ tag: taxonomyKey(tag) }, basePath)}
                                                    className={cn(tagPill, "transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand motion-reduce:transition-none", focusRing)}
                                                >
                                                    {tag}
                                                </Link>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </footer>
                        )}
                    </div>

                    {rail && (
                        <div className="hidden lg:block">
                            <BlogToc headings={headings} variant="sidebar" />
                        </div>
                    )}
                </div>

                {/* Outside the grid, so the rail stops following the reader once the article itself has ended. */}
                {comments && <div className={MEASURE}>{comments}</div>}
            </div>

            {related.length > 0 && (
                <section aria-labelledby="blog-related" className="border-t border-border bg-muted/40 py-14 md:py-20">
                    <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
                        <div className="mb-8 flex items-end justify-between gap-4">
                            <h2 id="blog-related" className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                                Keep reading
                            </h2>
                            {!preview && (
                                <Link
                                    href={basePath}
                                    className={cn("shrink-0 rounded-md py-1 text-sm font-medium text-brand underline-offset-4 hover:underline", focusRing)}
                                >
                                    View all posts
                                </Link>
                            )}
                        </div>

                        <ul role="list" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {related.map((item) => (
                                // Each card reads in the direction of its own title, whatever the article above it is.
                                <li key={item.id} dir={textDirection(item.title) ?? "ltr"} className="h-full [&>article]:h-full">
                                    <BlogCard blog={item} basePath={basePath} />
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            )}
        </article>
    );
}
