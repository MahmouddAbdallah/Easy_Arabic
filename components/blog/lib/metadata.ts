import type { Metadata } from "next";
import { blogPostPath } from "./constants";
import { getExcerpt, type BlogRecord } from "./types";

/** Absolute URL for a path, built from APP_URL (never from request headers). `null` when APP_URL isn't set. */
export function absoluteUrl(path: string): string | null {
    const base = (process.env.APP_URL ?? "").replace(/\/+$/, "");
    return base ? `${base}${path}` : null;
}

export const canonicalUrlOf = (blog: Pick<BlogRecord, "slug" | "seo">) =>
    blog.seo.canonicalUrl || absoluteUrl(blogPostPath(blog.slug));

/** `<head>` metadata for a post: SEO overrides first, then the post's own title, excerpt and cover. */
export function buildBlogMetadata(blog: BlogRecord): Metadata {
    const title = blog.seo.title || blog.title;
    const description = blog.seo.description || getExcerpt(blog) || undefined;
    const canonical = canonicalUrlOf(blog);
    const cover = blog.coverImage;

    return {
        title,
        description,
        alternates: canonical ? { canonical } : undefined,
        robots: blog.seo.noIndex ? { index: false, follow: false } : undefined,
        openGraph: {
            type: "article",
            title,
            description,
            url: canonical ?? undefined,
            publishedTime: blog.publishedAt ?? undefined,
            modifiedTime: blog.updatedAt,
            authors: [blog.author.name],
            tags: blog.tags.length ? blog.tags : undefined,
            images: cover ? [{ url: cover.url, alt: cover.alt || blog.title, width: cover.width, height: cover.height }] : undefined,
        },
        twitter: {
            card: cover ? "summary_large_image" : "summary",
            title,
            description,
            images: cover ? [cover.url] : undefined,
        },
    };
}
