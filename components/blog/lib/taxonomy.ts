import { BLOG_LIMITS } from "./constants";
import { taxonomyKey } from "./slug";
import type { BlogSummary, BlogTaxonomyItem } from "./types";

/** One category per post, trimmed and length-limited. Empty means "uncategorized" (`null`). */
export function normalizeCategory(input: unknown): string | null {
    if (typeof input !== "string") return null;
    const name = input.replace(/\s+/g, " ").trim().slice(0, BLOG_LIMITS.category).trim();
    return name || null;
}

/** Trims, drops a leading "#", removes duplicates (compared by slug form) and caps the count. */
export function normalizeTags(input: unknown): string[] {
    if (!Array.isArray(input)) return [];
    const seen = new Set<string>();
    const tags: string[] = [];

    for (const raw of input) {
        if (typeof raw !== "string") continue;
        const tag = raw.replace(/^#+/, "").replace(/\s+/g, " ").trim().slice(0, BLOG_LIMITS.tag).trim();
        const key = taxonomyKey(tag);
        if (!tag || !key || seen.has(key)) continue;
        seen.add(key);
        tags.push(tag);
        if (tags.length >= BLOG_LIMITS.tags) break;
    }
    return tags;
}

function tally(names: Iterable<string>): BlogTaxonomyItem[] {
    const byKey = new Map<string, BlogTaxonomyItem>();
    for (const name of names) {
        const slug = taxonomyKey(name);
        if (!slug) continue;
        const existing = byKey.get(slug);
        if (existing) existing.count += 1;
        else byKey.set(slug, { name, slug, count: 1 });
    }
    return [...byKey.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Categories and tags in use, with how many posts each has. The first spelling seen is the display name. */
export function buildTaxonomy(blogs: readonly BlogSummary[]): { categories: BlogTaxonomyItem[]; tags: BlogTaxonomyItem[] } {
    return {
        categories: tally(blogs.flatMap((blog) => (blog.category ? [blog.category] : []))),
        tags: tally(blogs.flatMap((blog) => blog.tags)),
    };
}
