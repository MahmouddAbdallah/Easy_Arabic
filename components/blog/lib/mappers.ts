import { BLOG_CONTENT_VERSION } from "./constants";
import { parseStoredContent } from "./content";
import { normalizeCategory, normalizeTags } from "./taxonomy";
import { isHttpsUrl } from "./url";
import type { BlogAuthor, BlogImage, BlogRecord, BlogSeo, BlogStatus, BlogSummary } from "./types";

/**
 * Firestore document <-> Blog records. This file never imports Firebase: timestamps are recognised by
 * shape (`toDate()`), which keeps it plain, fast, and testable without a database.
 */

/** The fields a list or card needs. Used with `.select()` so the content body is never downloaded for lists. */
export const SUMMARY_FIELDS = [
    "title",
    "slug",
    "status",
    "excerpt",
    "autoExcerpt",
    "category",
    "tags",
    "coverImage",
    "author",
    "readingTime",
    "createdAt",
    "updatedAt",
    "publishedAt",
] as const;

type Data = Record<string, unknown>;

const isObject = (value: unknown): value is Data => typeof value === "object" && value !== null && !Array.isArray(value);
const asString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const asNumber = (value: unknown, fallback = 0) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);

/** Firestore `Timestamp` | `Date` | ISO string -> ISO string. */
export function toIso(value: unknown): string | null {
    if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
        return (value as { toDate: () => Date }).toDate().toISOString();
    }
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
    return null;
}

function toImage(value: unknown): BlogImage | null {
    if (!isObject(value) || !isHttpsUrl(value.url)) return null;
    const image: BlogImage = { url: value.url, alt: asString(value.alt) };
    if (typeof value.publicId === "string") image.publicId = value.publicId;
    if (typeof value.width === "number") image.width = value.width;
    if (typeof value.height === "number") image.height = value.height;
    return image;
}

function toAuthor(value: unknown): BlogAuthor {
    return isObject(value)
        ? { id: asString(value.id), name: asString(value.name, "Easy Arabic") }
        : { id: "", name: "Easy Arabic" };
}

export function toSeo(value: unknown): BlogSeo {
    const seo = isObject(value) ? value : {};
    return {
        title: asString(seo.title),
        description: asString(seo.description),
        canonicalUrl: asString(seo.canonicalUrl),
        noIndex: seo.noIndex === true,
    };
}

const toStatus = (value: unknown): BlogStatus => (value === "published" ? "published" : "draft");

export function summaryFromData(id: string, data: Data): BlogSummary {
    const created = toIso(data.createdAt) ?? new Date(0).toISOString();
    return {
        id,
        title: asString(data.title),
        slug: asString(data.slug),
        status: toStatus(data.status),
        excerpt: asString(data.excerpt),
        autoExcerpt: asString(data.autoExcerpt),
        category: normalizeCategory(data.category),
        tags: normalizeTags(data.tags),
        coverImage: toImage(data.coverImage),
        author: toAuthor(data.author),
        readingTime: Math.max(1, asNumber(data.readingTime, 1)),
        createdAt: created,
        updatedAt: toIso(data.updatedAt) ?? created,
        publishedAt: toIso(data.publishedAt),
    };
}

export function recordFromData(id: string, data: Data): BlogRecord {
    return {
        ...summaryFromData(id, data),
        content: parseStoredContent(data.content, id),
        seo: toSeo(data.seo),
        wordCount: asNumber(data.wordCount),
        contentVersion: asNumber(data.contentVersion, BLOG_CONTENT_VERSION),
    };
}

/** A post is public only while it is published and its publish time has arrived. */
export const isPubliclyVisible = (blog: Pick<BlogSummary, "status" | "publishedAt">, now: Date = new Date()) =>
    blog.status === "published" && blog.publishedAt !== null && new Date(blog.publishedAt).getTime() <= now.getTime();

/** Firestore document ids can't contain "/" and a few other shapes; blog ids are Firestore auto-ids. */
export const isValidBlogId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id);
