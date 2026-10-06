import { z } from "zod";
import { BLOG_LIMITS, MAX_PAGE_SIZE } from "./constants";
import { BLOG_STATUSES, type BlogAdminQuery, type BlogStatusFilter } from "./types";
import { isHttpsUrl } from "./url";

/**
 * Request schemas for /api/blog and /api/blog/[blogId]. Zod stays on the server: the browser only
 * needs the inferred types (`import type`), so it never reaches the client bundle.
 *
 * These check the *shape and size* of the request. What the content may contain is checked separately
 * by `sanitizeDocument`, and the normalisation of category/tags/slug happens in the data layer.
 */

const titleField = z.string().trim().min(1, "Give the post a title").max(BLOG_LIMITS.title, `Keep the title under ${BLOG_LIMITS.title} characters`);

const httpsUrl = z.string().max(BLOG_LIMITS.url).refine(isHttpsUrl, "Must be a full https:// address");

export const CoverImageSchema = z.object({
    url: httpsUrl,
    alt: z.string().trim().max(BLOG_LIMITS.alt, `Keep the image description under ${BLOG_LIMITS.alt} characters`).default(""),
    publicId: z.string().max(300).optional(),
    width: z.number().int().positive().max(100_000).optional(),
    height: z.number().int().positive().max(100_000).optional(),
});

export const SeoSchema = z.object({
    title: z.string().trim().max(BLOG_LIMITS.seoTitle, `Keep the SEO title under ${BLOG_LIMITS.seoTitle} characters`).default(""),
    description: z
        .string()
        .trim()
        .max(BLOG_LIMITS.seoDescription, `Keep the SEO description under ${BLOG_LIMITS.seoDescription} characters`)
        .default(""),
    canonicalUrl: z
        .string()
        .trim()
        .max(BLOG_LIMITS.url)
        // .refine((value) => value === "" || isHttpsUrl(value), "Must be a full https:// address")
        .default(""),
    noIndex: z.boolean().default(false),
});

/** POST /api/blog: start a draft. Everything else is filled in by the editor. */
export const CreateBlogSchema = z.object({ title: titleField });

/**
 * PATCH /api/blog/[blogId]: every field is optional, so the editor can save the whole form and a
 * list row can flip just `status`. `baseUpdatedAt` is the `updatedAt` the caller loaded: if the post
 * changed since, the save is refused (409) instead of silently overwriting someone else's edit.
 */
export const UpdateBlogSchema = z.object({
    title: titleField.optional(),
    /** Empty = derive from the title. Anything else is cleaned into a valid slug. */
    slug: z.string().trim().max(200).optional(),
    excerpt: z.string().trim().max(BLOG_LIMITS.excerpt, `Keep the excerpt under ${BLOG_LIMITS.excerpt} characters`).optional(),
    category: z.string().max(200).nullable().optional(),
    tags: z.array(z.string().max(200)).max(100).optional(),
    coverImage: CoverImageSchema.nullable().optional(),
    seo: SeoSchema.optional(),
    status: z.enum(BLOG_STATUSES).optional(),
    content: z.unknown().optional(),
    baseUpdatedAt: z.string().max(40).optional(),
});

export type CreateBlogInput = z.output<typeof CreateBlogSchema>;
export type UpdateBlogInput = z.output<typeof UpdateBlogSchema>;

/* ------------------------------------------------------- Query-string input */

const toPositiveInt = (value: string | null, fallback: number, max = Number.MAX_SAFE_INTEGER) => {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};

/**
 * GET /api/blog?page=&pageSize=&search=&status=&category=. Parsed by hand rather than rejected: a
 * stale or hand-edited URL should still show a list, not an error.
 */
export function parseAdminListQuery(params: URLSearchParams): BlogAdminQuery {
    const rawStatus = params.get("status");
    const status: BlogStatusFilter = rawStatus === "draft" || rawStatus === "published" ? rawStatus : "all";
    return {
        page: toPositiveInt(params.get("page"), 1),
        pageSize: toPositiveInt(params.get("pageSize"), 10, MAX_PAGE_SIZE),
        search: (params.get("search") ?? "").slice(0, 100),
        status,
        category: (params.get("category") ?? "").slice(0, BLOG_LIMITS.category),
    };
}
