import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Blog } from "@/components/blog/Blog";
import { getPublishedBlog, resolvePublishedBlogId } from "@/components/blog/lib/blogs.server";
import { buildBlogMetadata } from "@/components/blog/lib/metadata";

// See app/blog/page.tsx.
export const dynamic = "force-dynamic";

interface BlogPostPageProps {
    params: Promise<{ slug: string }>;
}

/** Slugs may be Arabic, and the router hands them over percent-encoded. */
function decodeSlug(raw: string) {
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

// `resolvePublishedBlogId` and `getPublishedBlog` are request-cached, so the metadata and the page
// below share one read of the post instead of each fetching it.
export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
    const { slug } = await params;
    const blogId = await resolvePublishedBlogId(decodeSlug(slug));
    const blog = blogId ? await getPublishedBlog(blogId) : null;

    if (!blog) return { title: "Post not found", robots: { index: false } };
    return buildBlogMetadata(blog);
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
    const { slug } = await params;
    const blogId = await resolvePublishedBlogId(decodeSlug(slug));
    if (!blogId) notFound();

    return <Blog blogId={blogId} showRelated showComments notFoundIfMissing />;
}
