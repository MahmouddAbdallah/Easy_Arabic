import { MAX_PAGE_SIZE } from "./constants";
import { taxonomyKey } from "./slug";
import { buildTaxonomy } from "./taxonomy";
import type {
    BlogAdminList,
    BlogAdminQuery,
    BlogPagination,
    BlogPublicList,
    BlogStatusFilter,
    BlogSummary,
} from "./types";

/** In-memory filtering and pagination over lean summaries. Pure, so it is shared by the dashboard API and the public pages. */

export function paginate<T>(items: readonly T[], page: number, pageSize: number): { items: T[]; pagination: BlogPagination } {
    const size = Math.min(Math.max(1, Math.floor(pageSize) || 1), MAX_PAGE_SIZE);
    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / size));
    // A page past the end (a stale link, a deleted post) lands on the last page instead of showing nothing.
    const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
    return {
        items: items.slice((current - 1) * size, current * size),
        pagination: {
            page: current,
            pageSize: size,
            totalItems,
            totalPages,
            hasNextPage: current < totalPages,
            hasPreviousPage: current > 1,
        },
    };
}

const matchesSearch = (blog: BlogSummary, needle: string) =>
    [blog.title, blog.slug, blog.category ?? "", blog.excerpt, blog.autoExcerpt, blog.author.name, ...blog.tags].some((field) =>
        field.toLowerCase().includes(needle)
    );

export function buildAdminList(
    all: readonly BlogSummary[],
    query: BlogAdminQuery,
    meta: { truncated: boolean }
): BlogAdminList {
    const needle = query.search.trim().toLowerCase();
    const categoryKey = query.category ? taxonomyKey(query.category) : "";

    // Counts describe the search + category scope, so the status tabs add up to what the search found.
    const scoped = all.filter(
        (blog) =>
            (!needle || matchesSearch(blog, needle)) &&
            (!categoryKey || (blog.category !== null && taxonomyKey(blog.category) === categoryKey))
    );
    const counts: Record<BlogStatusFilter, number> = {
        all: scoped.length,
        draft: scoped.filter((blog) => blog.status === "draft").length,
        published: scoped.filter((blog) => blog.status === "published").length,
    };

    const visible = query.status === "all" ? scoped : scoped.filter((blog) => blog.status === query.status);
    const { items, pagination } = paginate(visible, query.page, query.pageSize);
    const { categories, tags } = buildTaxonomy(all);

    return {
        data: items,
        pagination,
        counts,
        categories: categories.map((item) => item.name),
        tags: tags.map((item) => item.name),
        truncated: meta.truncated,
    };
}

export function buildPublicList(
    published: readonly BlogSummary[],
    query: { page: number; pageSize: number; category?: string; tag?: string },
    meta: { truncated: boolean }
): BlogPublicList {
    const filtered = published.filter(
        (blog) =>
            (!query.category || (blog.category !== null && taxonomyKey(blog.category) === query.category)) &&
            (!query.tag || blog.tags.some((tag) => taxonomyKey(tag) === query.tag))
    );
    const { items, pagination } = paginate(filtered, query.page, query.pageSize);
    // Taxonomy is built from every published post, not the filtered ones, so the filter bar never shrinks as you filter.
    const { categories, tags } = buildTaxonomy(published);
    return { data: items, pagination, categories, tags, truncated: meta.truncated };
}

/**
 * Posts worth reading next: ranked by shared category (worth more) and shared tags, newest first on
 * ties, never the current post. `published` is already newest-first, so a stable sort keeps that order.
 */
export function pickRelated(
    published: readonly BlogSummary[],
    current: Pick<BlogSummary, "id" | "category" | "tags">,
    limit = 3
): BlogSummary[] {
    const categoryKey = current.category ? taxonomyKey(current.category) : "";
    const tagKeys = new Set(current.tags.map(taxonomyKey));

    return published
        .filter((blog) => blog.id !== current.id)
        .map((blog, index) => ({
            blog,
            index,
            score:
                (categoryKey && blog.category && taxonomyKey(blog.category) === categoryKey ? 2 : 0) +
                blog.tags.filter((tag) => tagKeys.has(taxonomyKey(tag))).length,
        }))
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, limit)
        .map((entry) => entry.blog);
}
