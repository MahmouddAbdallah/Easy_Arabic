import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "cn";
import { BlogMeta } from "../BlogMeta";
import { BLOG_BASE_PATH, blogIndexPath, blogPostPath } from "../lib/constants";
import { textDirection } from "../lib/direction";
import { taxonomyKey } from "../lib/slug";
import { getExcerpt, type BlogSummary } from "../lib/types";
import { CoverImage } from "./CoverImage";
import { FOCUS_RING, SHELL } from "./styles";

interface FeaturedPostProps {
    blog: BlogSummary;
    basePath?: string;
}

/**
 * The lead story: the page's one large picture, with the headline set big beside it. The whole article
 * is one click target (the headline's link stretches over it) and it reads in its own direction, so an
 * Arabic story puts its picture on the right and its text flush right, mirrored as a whole.
 */
export function FeaturedPost({ blog, basePath = BLOG_BASE_PATH }: FeaturedPostProps) {
    const excerpt = getExcerpt(blog);
    const direction = textDirection(blog.title) ?? "ltr";

    return (
        <section id="featured" aria-label="Featured article" className="scroll-mt-20 py-12 md:py-16 lg:py-20">
            <div className={SHELL}>
                <article
                    dir={direction}
                    className="group relative grid items-center gap-7 rounded-3xl has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-brand/50 has-[a:focus-visible]:ring-offset-8 has-[a:focus-visible]:ring-offset-background lg:grid-cols-12 lg:gap-12"
                >
                    <div className="relative aspect-16/10 overflow-hidden rounded-3xl bg-brand-deep ring-1 ring-border lg:col-span-7">
                        <CoverImage cover={blog.coverImage} widths={[640, 960, 1280, 1600]} sizes="(min-width: 1280px) 720px, (min-width: 1024px) 58vw, 100vw" eager />
                    </div>

                    <div className="lg:col-span-5">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <span className="rounded-full bg-gold-soft px-3 py-1 text-sm font-medium text-gold-ink">Featured</span>
                            {blog.category && (
                                // Above the headline's stretched link (z-10), so the category is its own click target.
                                <Link
                                    href={blogIndexPath({ category: taxonomyKey(blog.category) }, basePath)}
                                    className={cn("relative z-10 rounded-md py-1 text-sm font-semibold text-brand underline-offset-4 hover:underline", FOCUS_RING)}
                                >
                                    {blog.category}
                                </Link>
                            )}
                        </div>

                        <h2 className="mt-5 font-display text-[2rem] leading-[1.1] font-bold tracking-tight text-balance wrap-break-word text-foreground sm:text-4xl lg:text-[2.75rem] [&[dir=rtl]]:leading-[1.4] [&[dir=rtl]]:tracking-normal" dir={direction}>
                            <Link
                                href={blogPostPath(blog.slug, basePath)}
                                className="outline-none decoration-gold decoration-[3px] underline-offset-[0.2em] after:absolute after:inset-0 group-hover:underline"
                            >
                                {blog.title}
                            </Link>
                        </h2>

                        {excerpt && (
                            <p dir="auto" className="mt-4 line-clamp-4 text-lg leading-relaxed text-muted-foreground [&[dir=rtl]]:leading-[1.85]">
                                {excerpt}
                            </p>
                        )}

                        <BlogMeta className="mt-7" authorName={blog.author.name} date={blog.publishedAt} readingTime={blog.readingTime} />

                        {/* Looks like a button, but the headline's link is the real one (two links to one place would be two tab stops). */}
                        <span
                            aria-hidden
                            className="mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-6 text-sm font-bold text-brand-foreground transition-colors group-hover:bg-brand/90 motion-reduce:transition-none"
                        >
                            Read the article
                            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                        </span>
                    </div>
                </article>
            </div>
        </section>
    );
}
