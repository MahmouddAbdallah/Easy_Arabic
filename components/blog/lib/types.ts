/**
 * Shapes shared by the Dashboard, the API, the data layer and the public components.
 * Everything here is plain, serializable data (dates are ISO strings), so it can cross the
 * server/client boundary untouched.
 */

/* ----------------------------------------------------------------- Content */

/**
 * The post body is a structured document (ProseMirror / Tiptap JSON), never an HTML string.
 * These lists are the single source of truth for what a document may contain: the editor, the
 * server-side sanitizer and the public renderer all agree on them.
 */
export const BLOG_MARK_TYPES = ["bold", "italic", "underline", "strike", "code", "highlight", "link"] as const;
export type BlogMarkType = (typeof BLOG_MARK_TYPES)[number];

export const BLOG_NODE_TYPES = [
    "paragraph",
    "heading",
    "blockquote",
    "bulletList",
    "orderedList",
    "listItem",
    "codeBlock",
    "horizontalRule",
    "hardBreak",
    "image",
    "video",
    "embed",
    "callout",
    "text",
] as const;
export type BlogNodeType = (typeof BLOG_NODE_TYPES)[number];

/** "recommended" is the highlighted "our pick" box; the others are the usual note styles. */
export const CALLOUT_VARIANTS = ["info", "tip", "warning", "recommended"] as const;
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number];

export const EMBED_PROVIDERS = ["youtube", "vimeo"] as const;
export type EmbedProvider = (typeof EMBED_PROVIDERS)[number];

export interface BlogMark {
    type: BlogMarkType;
    attrs?: { href?: string };
}

export type BlogNodeAttrs = Record<string, string | number | boolean | null | undefined>;

export interface BlogNode {
    type: BlogNodeType;
    attrs?: BlogNodeAttrs;
    content?: BlogNode[];
    marks?: BlogMark[];
    text?: string;
}

export interface BlogDoc {
    type: "doc";
    content: BlogNode[];
}

/* ------------------------------------------------------------------ Fields */

export const BLOG_STATUSES = ["draft", "published"] as const;
export type BlogStatus = (typeof BLOG_STATUSES)[number];

export interface BlogImage {
    /** Permanent https URL (Cloudinary). */
    url: string;
    alt: string;
    publicId?: string;
    width?: number;
    height?: number;
}

/** Empty strings mean "not set": the page falls back to the post's own title / excerpt / cover. */
export interface BlogSeo {
    title: string;
    description: string;
    canonicalUrl: string;
    noIndex: boolean;
}

export interface BlogAuthor {
    id: string;
    name: string;
}

/* ----------------------------------------------------------------- Records */

/** What lists and cards need. Deliberately has no content body, so listing stays cheap. */
export interface BlogSummary {
    id: string;
    title: string;
    slug: string;
    status: BlogStatus;
    /** Written by the author. May be empty; use `getExcerpt()` for display. */
    excerpt: string;
    /** Derived from the body on every save. */
    autoExcerpt: string;
    category: string | null;
    tags: string[];
    coverImage: BlogImage | null;
    author: BlogAuthor;
    /** Minutes. */
    readingTime: number;
    createdAt: string;
    updatedAt: string;
    /** Set while the post is published, `null` for drafts. */
    publishedAt: string | null;
}

/** A whole post, as the editor loads it and as the public page renders it. */
export interface BlogRecord extends BlogSummary {
    content: BlogDoc;
    seo: BlogSeo;
    wordCount: number;
    contentVersion: number;
}

/** The part of a post the article view needs. The editor's live preview builds one from unsaved form values. */
export type BlogArticleData = Pick<
    BlogRecord,
    "title" | "slug" | "excerpt" | "autoExcerpt" | "category" | "tags" | "coverImage" | "author" | "readingTime" | "publishedAt" | "updatedAt" | "content"
>;

/* ----------------------------------------------------------------- Listing */

export interface BlogPagination {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

export type BlogStatusFilter = "all" | BlogStatus;

export interface BlogAdminQuery {
    page: number;
    pageSize: number;
    search: string;
    status: BlogStatusFilter;
    category: string;
}

export interface BlogAdminList {
    data: BlogSummary[];
    pagination: BlogPagination;
    /** Totals before the status filter, so the tabs can show their counts. */
    counts: Record<BlogStatusFilter, number>;
    /** Every category and tag in use, for the editor's suggestions and the category filter. */
    categories: string[];
    tags: string[];
    /** True when the scan hit `ADMIN_SCAN_LIMIT` and older posts are not listed. */
    truncated: boolean;
}

export interface BlogTaxonomyItem {
    /** Display name. */
    name: string;
    /** URL-safe key used in `?category=` / `?tag=`. */
    slug: string;
    count: number;
}

export interface BlogPublicList {
    data: BlogSummary[];
    pagination: BlogPagination;
    categories: BlogTaxonomyItem[];
    tags: BlogTaxonomyItem[];
    truncated: boolean;
}

/** An uploaded file, as the media route reports it. */
export interface BlogUploadedMedia {
    url: string;
    publicId: string;
    resourceType: "image" | "video";
    width?: number;
    height?: number;
    bytes?: number;
    format?: string;
    /** Videos: a still frame to show before playback. */
    poster?: string;
}

/** Excerpt to display: what the author wrote, otherwise the one derived from the body. */
export const getExcerpt = (blog: Pick<BlogSummary, "excerpt" | "autoExcerpt">) => blog.excerpt || blog.autoExcerpt;
