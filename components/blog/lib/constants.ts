/**
 * Everything tunable about the Blog lives here: where it is mounted, where it stores data,
 * and how big things may get. Safe to import from both server and client code.
 */

/* ------------------------------------------------------------------ Routes */

/**
 * Where the public Blog is mounted. To move it to another route, rename `app/blog` and change this
 * one constant: every link the Blog builds (cards, tags, categories, "back to blog") reads it.
 */
export const BLOG_BASE_PATH = "/blog";

/** Public URL path of a post. Slugs may contain non-Latin letters (Arabic), so they are encoded. */
export const blogPostPath = (slug: string, basePath: string = BLOG_BASE_PATH) =>
    `${basePath}/${encodeURIComponent(slug)}`;

/** Public list URL with optional taxonomy filters (slugs, not display names). */
export const blogIndexPath = (
    params: { category?: string | null; tag?: string | null; page?: number } = {},
    basePath: string = BLOG_BASE_PATH
) => {
    const search = new URLSearchParams();
    if (params.category) search.set("category", params.category);
    if (params.tag) search.set("tag", params.tag);
    if (params.page && params.page > 1) search.set("page", String(params.page));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
};

export const BLOG_API_URL = "/api/blog";
export const blogItemApiUrl = (blogId: string) => `${BLOG_API_URL}/${blogId}`;
export const blogMediaApiUrl = (blogId: string) => `${BLOG_API_URL}/${blogId}/media`;

/* --------------------------------------------------------------- Firestore */

export const BLOG_COLLECTION = "blogs";
/** One tiny document per slug in use. Created in the same transaction as the post: that is what makes slugs unique. */
export const BLOG_SLUG_COLLECTION = "blogSlugs";

/** Bump when the stored content shape changes in a way that needs a migration. */
export const BLOG_CONTENT_VERSION = 1;

/**
 * Listing reads a lean projection (no content body) of at most this many documents, then filters and
 * paginates in memory. That keeps every query on automatic single-field indexes (nothing to create in
 * the Firebase console). If a blog ever outgrows it, the data layer logs a warning.
 */
export const ADMIN_SCAN_LIMIT = 500;
export const PUBLIC_SCAN_LIMIT = 300;

export const ADMIN_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;
export const PUBLIC_PAGE_SIZE = 9;

/* ------------------------------------------------------------------ Limits */

export const BLOG_LIMITS = {
    title: 160,
    slug: 80,
    excerpt: 300,
    category: 40,
    tag: 30,
    tags: 10,
    seoTitle: 70,
    seoDescription: 170,
    url: 2048,
    alt: 200,
    caption: 300,
    /** One text node. */
    textNode: 50_000,
    /** Serialized content JSON. Firestore documents are capped at 1 MiB; this leaves room for the rest. */
    contentBytes: 700_000,
    contentNodes: 20_000,
    contentDepth: 24,
    /** Auto-generated excerpt length. */
    autoExcerpt: 200,
} as const;

/** Words per minute used for the reading-time estimate. */
export const READING_WORDS_PER_MINUTE = 200;

/** A table of contents is shown once a post has at least this many headings. */
export const TOC_MIN_HEADINGS = 3;

/* ------------------------------------------------------------------- Media */

/** Same default root folder as `lib/handleFiles.ts`; passed explicitly so the clean-up guard below stays in sync. */
export const CLOUDINARY_ROOT_FOLDER = "ease_arabic";

/** Each post uploads into its own folder, so deleting a post removes exactly that post's files and no one else's. */
export const blogMediaFolder = (blogId: string) => `blog/${blogId}`;

export const MEDIA_RULES = {
    image: {
        maxBytes: 10 * 1024 * 1024,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
    },
    video: {
        /**
         * Uploads pass through the Next.js server (that is how `handleUploadCloudinary` works). Hosts
         * with a request-body cap (Vercel: 4.5 MB) will refuse large videos long before this limit;
         * embedding a YouTube/Vimeo link has no such limit.
         */
        maxBytes: 50 * 1024 * 1024,
        mimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
    },
} as const;

export type BlogMediaKind = keyof typeof MEDIA_RULES;

/** 30 uploads per minute per admin. */
export const MEDIA_RATE_LIMIT = { limit: 30, windowSeconds: 60 } as const;
