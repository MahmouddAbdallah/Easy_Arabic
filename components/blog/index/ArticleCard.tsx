import Link from "next/link";
import { Clock } from "lucide-react";
import { cn } from "cn";
import { BLOG_BASE_PATH, blogIndexPath, blogPostPath } from "../lib/constants";
import { textDirection } from "../lib/direction";
import { formatPublicDate, formatReadingTime } from "../lib/format";
import { taxonomyKey } from "../lib/slug";
import { getExcerpt, type BlogSummary } from "../lib/types";
import { CoverImage } from "./CoverImage";
import { FOCUS_RING } from "./styles";

interface ArticleCardProps {
    blog: BlogSummary;
    /** `lead`: a larger preview (taller picture, bigger headline) for the first articles under the lead story. */
    size?: "standard" | "lead";
    /** The picture is near the top of the page: fetch it now. */
    eager?: boolean;
    basePath?: string;
}

/**
 * An article preview: the picture, then the words, directly on the page. There is no card box around
 * it; the picture's own edge is the card, which keeps a grid of them quiet and lets the headlines set
 * the rhythm. The whole preview is one click target (the headline's link stretches over it), except the
 * category, which links to that category.
 *
 * Each preview reads in the direction of its own headline, whatever the page around it is: an Arabic
 * article's category, headline and excerpt sit flush right, an English one's flush left.
 */
export function ArticleCard({ blog, size = "standard", eager = false, basePath = BLOG_BASE_PATH }: ArticleCardProps) {
    const lead = size === "lead";
    const excerpt = getExcerpt(blog);
    const direction = textDirection(blog.title) ?? "ltr";

    return (
        <article
            dir={direction}
            className="group relative flex h-full flex-col rounded-2xl has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-brand/50 has-[a:focus-visible]:ring-offset-8 has-[a:focus-visible]:ring-offset-background"
        >
            <div className={cn("relative overflow-hidden rounded-2xl bg-brand-deep ring-1 ring-border", lead ? "aspect-16/10" : "aspect-3/2")}>
                <CoverImage
                    cover={blog.coverImage}
                    widths={lead ? [480, 800, 1200] : [400, 640, 960]}
                    sizes={lead ? "(min-width: 1280px) 600px, (min-width: 768px) 46vw, 100vw" : "(min-width: 1280px) 384px, (min-width: 1024px) 31vw, (min-width: 640px) 46vw, 100vw"}
                    eager={eager}
                />
            </div>

            <div className="mt-5 flex flex-1 flex-col gap-3">
                <div className="flex min-h-6 items-center justify-between gap-4 text-sm">
                    {blog.category ? (
                        <Link
                            href={blogIndexPath({ category: taxonomyKey(blog.category) }, basePath)}
                            className={cn("relative z-10 -mx-1 truncate rounded px-1 font-semibold text-brand underline-offset-4 hover:underline", FOCUS_RING)}
                        >
                            {blog.category}
                        </Link>
                    ) : (
                        <span />
                    )}
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground">
                        <Clock aria-hidden className="size-3.5" />
                        {/* Isolated: a digit-first English string would otherwise read "min read 7" inside an Arabic preview. */}
                        <bdi dir="ltr">{formatReadingTime(blog.readingTime)}</bdi>
                    </span>
                </div>

                <h3
                    dir={direction}
                    // The size comes first on purpose: this project's `cn` (like tailwind-merge) treats a font-size
                    // as also setting the line height, and drops an EARLIER `leading-*` when one follows it.
                    className={cn(
                        lead ? "text-[1.75rem] md:text-[2rem]" : "text-[1.4rem]",
                        "font-display leading-[1.2] font-bold tracking-tight text-balance wrap-break-word text-foreground [&[dir=rtl]]:leading-[1.45] [&[dir=rtl]]:tracking-normal"
                    )}
                >
                    <Link
                        href={blogPostPath(blog.slug, basePath)}
                        className="outline-none decoration-gold decoration-2 underline-offset-[0.2em] after:absolute after:inset-0 group-hover:underline"
                    >
                        {blog.title}
                    </Link>
                </h3>

                {excerpt && (
                    <p dir="auto" className={cn(lead ? "text-base" : "text-[0.95rem]", "line-clamp-3 leading-relaxed text-muted-foreground [&[dir=rtl]]:leading-[1.85]")}>
                        {excerpt}
                    </p>
                )}

                {blog.publishedAt && (
                    <time dateTime={blog.publishedAt} dir="ltr" className="mt-auto pt-1 text-sm text-muted-foreground">
                        {formatPublicDate(blog.publishedAt)}
                    </time>
                )}
            </div>
        </article>
    );
}
