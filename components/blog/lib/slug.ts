import { BLOG_LIMITS } from "./constants";

/**
 * Slugs keep letters and digits from any script, so an Arabic title gets an Arabic slug instead of an
 * empty one. The patterns are built with `new RegExp` because Unicode property escapes need the `u` flag.
 */
const NOT_SLUG_CHARS = new RegExp("[^\\p{L}\\p{M}\\p{N}]+", "gu");
const VALID_SLUG = new RegExp("^[\\p{L}\\p{M}\\p{N}]+(?:-[\\p{L}\\p{M}\\p{N}]+)*$", "u");

/** Arabic diacritics (tashkeel), superscript alef, and tatweel: they change how a word looks, not what it is. */
const ARABIC_DECORATION = /[\u064B-\u065F\u0670\u0640]/g;

export function slugify(input: string, max: number = BLOG_LIMITS.slug): string {
    const slug = input
        .normalize("NFKC")
        .replace(ARABIC_DECORATION, "")
        .toLowerCase()
        // "don't" -> "dont", not "don-t"
        .replace(/['’`]/g, "")
        .replace(NOT_SLUG_CHARS, "-")
        .replace(/^-+|-+$/g, "");

    return slug.slice(0, max).replace(/-+$/, "");
}

export function isValidSlug(slug: string): boolean {
    return slug.length > 0 && slug.length <= BLOG_LIMITS.slug && VALID_SLUG.test(slug);
}

/** `base`, then `base-2`, `base-3` … : the first candidate `isTaken` says is free. */
export async function firstFreeSlug(base: string, isTaken: (slug: string) => Promise<boolean>): Promise<string> {
    const root = base || "post";
    for (let n = 1; n <= 50; n += 1) {
        const suffix = n === 1 ? "" : `-${n}`;
        const candidate = `${root.slice(0, BLOG_LIMITS.slug - suffix.length).replace(/-+$/, "")}${suffix}`;
        if (!(await isTaken(candidate))) return candidate;
    }
    // Extremely unlikely; a random tail guarantees progress.
    const tail = Math.random().toString(36).slice(2, 8);
    return `${root.slice(0, BLOG_LIMITS.slug - tail.length - 1)}-${tail}`;
}

/** Display names are compared by their slug form, so "Grammar" and "grammar " are one category. */
export const taxonomyKey = (name: string) => slugify(name, BLOG_LIMITS.slug);
