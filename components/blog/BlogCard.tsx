import Link from "next/link";
import { cn } from 'cn'
import { BLOG_BASE_PATH, blogPostPath } from "./lib/constants";
import { formatPublicDate, formatReadingTime } from "./lib/format";
import { getExcerpt, type BlogSummary } from "./lib/types";
import { cloudinaryImageVariant, cloudinarySrcSet } from "./lib/url";

interface BlogCardProps {
    blog: BlogSummary;
    /** Wide horizontal layout for the newest post. */
    featured?: boolean;
    /** Load the image eagerly (above the fold). */
    priority?: boolean;
    basePath?: string;
}

export function BlogCard({ blog, featured = false, priority = false, basePath = BLOG_BASE_PATH }: BlogCardProps) {
    const cover = blog.coverImage;
    const excerpt = getExcerpt(blog);
    const srcSet = cover ? cloudinarySrcSet(cover.url, [400, 640, 960]) : undefined;

    return (
        <article
            className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow duration-200 hover:shadow-lg has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-brand/50",
                featured && "md:flex-row"
            )}
        >
            <div className={cn("relative aspect-video shrink-0 overflow-hidden bg-brand-deep", featured && "md:aspect-auto md:min-h-72 md:w-[46%]")}>
                {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={cloudinaryImageVariant(cover.url, featured ? 960 : 640)}
                        srcSet={srcSet}
                        sizes={featured ? "(min-width: 768px) 460px, 100vw" : "(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"}
                        alt={cover.alt}
                        loading={priority ? "eager" : "lazy"}
                        decoding="async"
                        className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                    />
                ) : (
                    // No cover: the brand's star lattice on deep teal, so a post without an image still looks intentional.
                    <div
                        aria-hidden
                        className="absolute inset-0 pattern-khatam text-gold opacity-25"
                        style={{ ["--pattern-size" as string]: "56px" }}
                    />
                )}
            </div>

            <div className={cn("flex flex-1 flex-col gap-3 p-5", featured ? "md:justify-center md:p-8" : "md:p-6")}>
                {blog.category && <span className="w-fit rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">{blog.category}</span>}

                <h3 className={cn("font-display font-bold leading-snug tracking-tight text-foreground text-balance", featured ? "text-2xl md:text-3xl" : "text-xl")}>
                    {/* The link stretches over the whole card (after:absolute), so the card is one click target. */}
                    <Link href={blogPostPath(blog.slug, basePath)} dir="auto" className="outline-none after:absolute after:inset-0">
                        {blog.title}
                    </Link>
                </h3>

                {excerpt && (
                    <p dir="auto" className={cn("leading-relaxed text-muted-foreground", featured ? "line-clamp-4 text-base" : "line-clamp-3 text-sm")}>
                        {excerpt}
                    </p>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-1 pt-2 text-xs text-muted-foreground">
                    {blog.publishedAt && <time dateTime={blog.publishedAt}>{formatPublicDate(blog.publishedAt)}</time>}
                    <span dir="ltr">{formatReadingTime(blog.readingTime)}</span>
                </div>
            </div>
        </article>
    );
}
