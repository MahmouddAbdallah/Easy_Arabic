import { displayFont } from "@/lib/fonts";
import { BlogPagination } from "../BlogPagination";
import { BLOG_BASE_PATH, blogIndexPath } from "../lib/constants";
import { pluralize } from "../lib/format";
import { pickFeatured } from "../lib/listing";
import type { BlogPublicList } from "../lib/types";
import { ArticleGrid } from "./ArticleGrid";
import { BlogHero } from "./BlogHero";
import { BlogMasthead } from "./BlogMasthead";
import { EmptyState } from "./EmptyState";
import { FeaturedPost } from "./FeaturedPost";
import { SHELL } from "./styles";
import { TagCloud } from "./TagCloud";
import { TopicNav } from "./TopicNav";

export interface BlogIndexViewProps {
    /** One page of published posts plus the taxonomy, as the data layer returns it. */
    list: BlogPublicList;
    /** The filters in effect, as slugs (as in the URL), not display names. */
    category?: string;
    tag?: string;
    /** The page's name, in the small badge above the headline. */
    eyebrow?: string;
    /** The front page's headline (its `<h1>`). */
    title?: string;
    /** The front page's intro, under the headline. */
    description?: string;
    basePath?: string;
}

/**
 * The public list, drawn from data that is already loaded (so it is plain, synchronous and easy to
 * render with any list: `BlogIndex` fetches, this draws).
 *
 * It has two faces, chosen by where the reader is:
 *
 *  - the FRONT PAGE (first page, no filter): the hero, the lead story, the category bar, the articles,
 *    the tag band. This is where somebody arrives, so it welcomes and offers a way in;
 *  - everything else (a category, a tag, page 2 and beyond): a compact masthead saying where you are,
 *    then the category bar and the articles. Somebody who filtered wants the articles.
 *
 * Every number on the page is counted from `list`; no copy here states a figure of its own.
 */
export function BlogIndexView({
    list,
    category,
    tag,
    eyebrow = "The Easy Arabic Blog",
    title = "Read your way into Arabic and the Quran.",
    description = "Notes on learning Arabic and the Quran: study tips, lesson ideas, and news from the team.",
    basePath = BLOG_BASE_PATH,
}: BlogIndexViewProps) {
    const { pagination } = list;

    const hasFilter = Boolean(category || tag);
    const isFront = pagination.page === 1 && !hasFilter;
    const activeCategory = category ? list.categories.find((item) => item.slug === category) : undefined;
    const activeTag = tag ? list.tags.find((item) => item.slug === tag) : undefined;

    // The lead story is chosen only on the front page, where it is the reader's first article.
    const { featured, rest } = isFront ? pickFeatured(list.data) : { featured: undefined, rest: list.data };
    const hasArticles = list.data.length > 0;
    // The category bar is drawn when there is something to switch between (or a tag to clear).
    const hasTopicNav = list.categories.length > 0 || Boolean(activeTag);
    // Nothing to list when the front page has only its lead story, or when the blog is empty (the hero already says so).
    // A filter that matches nothing does get a list section, to explain itself.
    const showList = hasArticles ? rest.length > 0 : hasFilter;

    const masthead = category
        ? { kind: "Category", title: activeCategory?.name ?? category, summary: pluralize(pagination.totalItems, "article") }
        : tag
          ? { kind: "Tag", title: activeTag?.name ?? tag, summary: pluralize(pagination.totalItems, "article") }
          : { kind: "Archive", title: "All articles", summary: `Page ${pagination.page} of ${pagination.totalPages}` };

    return (
        <div className={displayFont.variable}>
            {isFront ? (
                <BlogHero
                    eyebrow={eyebrow}
                    title={title}
                    description={description}
                    totalPublished={list.totalPublished}
                    topicCount={list.categories.length}
                    latestPublishedAt={list.data[0]?.publishedAt ?? null}
                    hasFeatured={Boolean(featured)}
                    hasTopics={hasTopicNav}
                />
            ) : (
                <BlogMasthead {...masthead} backHref={basePath} />
            )}

            {featured && <FeaturedPost blog={featured} basePath={basePath} />}

            {/* The category bar and the list share this wrapper: the bar is sticky, and stays pinned for exactly as long as the list is on screen. */}
            <div>
                {hasTopicNav && (
                    <TopicNav categories={list.categories} totalPublished={list.totalPublished} category={category} activeTag={activeTag} basePath={basePath} />
                )}

                {showList && (
                    <section aria-labelledby="blog-list-title" className={`${SHELL} py-12 md:py-16`}>
                        {/* On the front page the heading is part of the design; elsewhere the masthead already says it, so it is for screen readers. */}
                        <div className={isFront && hasArticles ? "mb-10 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1" : "sr-only"}>
                            <h2 id="blog-list-title" className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                                {isFront ? "Latest articles" : "Articles"}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {pagination.totalPages > 1 ? `Page ${pagination.page} of ${pagination.totalPages}` : pluralize(pagination.totalItems, "article")}
                            </p>
                        </div>

                        {!hasArticles ? (
                            <EmptyState filtered={hasFilter} allHref={basePath} />
                        ) : (
                            <>
                                {/* The first row is likely on screen when the page loads, so its pictures aren't lazy. */}
                                <ArticleGrid posts={rest} withLead={isFront} eagerCount={isFront ? 2 : 3} basePath={basePath} />
                                <BlogPagination
                                    page={pagination.page}
                                    totalPages={pagination.totalPages}
                                    href={(target) => blogIndexPath({ category, tag, page: target }, basePath)}
                                />
                            </>
                        )}
                    </section>
                )}
            </div>

            <TagCloud tags={list.tags} activeTag={tag} basePath={basePath} />
        </div>
    );
}
