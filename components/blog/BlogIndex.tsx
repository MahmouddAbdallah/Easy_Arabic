import Link from "next/link";
import { X } from "lucide-react";
import { cn } from 'cn'
import { displayFont } from "@/lib/fonts";
import { BlogCard } from "./BlogCard";
import { BlogPagination } from "./BlogPagination";
import { listPublishedBlogs } from "./lib/blogs.server";
import { BLOG_BASE_PATH, PUBLIC_PAGE_SIZE, blogIndexPath } from "./lib/constants";

export interface BlogIndexProps {
    page?: number;
    /** Category / tag *slugs* (as in the URL), not display names. */
    category?: string;
    tag?: string;
    title?: string;
    description?: string;
    basePath?: string;
}

const chip = "inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors";

/** The public list of posts, with category filters and pagination. Reads from Firestore on the server. */
export async function BlogIndex({
    page = 1,
    category,
    tag,
    title = "Blog",
    description = "Notes on learning Arabic and the Quran: study tips, lesson ideas, and news from the team.",
    basePath = BLOG_BASE_PATH,
}: BlogIndexProps) {
    const list = await listPublishedBlogs({ page, pageSize: PUBLIC_PAGE_SIZE, category, tag });
    const { pagination } = list;
    const hasFilter = Boolean(category || tag);
    const activeTag = tag ? list.tags.find((item) => item.slug === tag) : undefined;

    // The newest post gets the wide card, but only on the unfiltered first page.
    const [first, ...rest] = list.data;
    const featured = pagination.page === 1 && !hasFilter && list.data.length > 1 ? first : undefined;
    const grid = featured ? rest : list.data;

    return (
        <div className={cn(displayFont.variable, "mx-auto w-full max-w-6xl px-5 pt-12 pb-20 md:px-8 md:pt-16")}>
            <header className="mb-10 max-w-2xl">
                <h1 className="font-display text-4xl leading-tight font-bold tracking-tight text-foreground md:text-6xl">{title}</h1>
                {description && <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{description}</p>}
                <div aria-hidden className="mt-7 h-0.5 w-16 rounded-full bg-gold" />
            </header>

            {(list.categories.length > 0 || activeTag) && (
                <nav aria-label="Filter posts" className="mb-10 flex flex-wrap items-center gap-2">
                    <Link
                        href={basePath}
                        aria-current={!hasFilter ? "page" : undefined}
                        className={cn(chip, !hasFilter ? "border-brand bg-brand text-brand-foreground" : "border-border text-muted-foreground hover:border-brand/40 hover:text-foreground")}
                    >
                        All posts
                    </Link>
                    {list.categories.map((item) => {
                        const active = category === item.slug;
                        return (
                            <Link
                                key={item.slug}
                                href={blogIndexPath({ category: item.slug }, basePath)}
                                aria-current={active ? "page" : undefined}
                                className={cn(chip, active ? "border-brand bg-brand text-brand-foreground" : "border-border text-muted-foreground hover:border-brand/40 hover:text-foreground")}
                            >
                                {item.name}
                                <span className={cn("text-xs tabular-nums", active ? "opacity-80" : "text-muted-foreground/70")}>{item.count}</span>
                            </Link>
                        );
                    })}
                    {activeTag && (
                        <Link href={basePath} className={cn(chip, "border-gold/50 bg-gold-soft text-gold-ink")}>
                            Tagged “{activeTag.name}”
                            <X aria-hidden className="size-3.5" />
                            <span className="sr-only">Clear tag filter</span>
                        </Link>
                    )}
                </nav>
            )}

            {list.data.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-6 py-20 text-center">
                    <p className="font-display text-2xl font-bold text-foreground">{hasFilter ? "No posts match that filter" : "No posts yet"}</p>
                    <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
                        {hasFilter ? "Try another category, or see everything we've published." : "The first one is on its way. Check back soon."}
                    </p>
                    {hasFilter && (
                        <Link href={basePath} className="mt-6 inline-flex h-10 items-center rounded-lg bg-brand px-5 text-sm font-medium text-brand-foreground hover:opacity-90">
                            See all posts
                        </Link>
                    )}
                </div>
            ) : (
                <>
                    {featured && (
                        <div className="mb-8">
                            <BlogCard blog={featured} featured priority basePath={basePath} />
                        </div>
                    )}
                    {grid.length > 0 && (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {grid.map((blog, index) => (
                                <BlogCard key={blog.id} blog={blog} priority={!featured && index < 3} basePath={basePath} />
                            ))}
                        </div>
                    )}
                    <BlogPagination
                        page={pagination.page}
                        totalPages={pagination.totalPages}
                        href={(target) => blogIndexPath({ category, tag, page: target }, basePath)}
                    />
                </>
            )}
        </div>
    );
}
