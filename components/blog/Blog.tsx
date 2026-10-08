import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { BlogArticle } from "./BlogArticle";
import { BlogComments } from "./comments/BlogComments";
import { BlogJsonLd } from "./BlogJsonLd";
import { getPublishedBlog, getRelatedBlogs } from "./lib/blogs.server";
import { BLOG_BASE_PATH } from "./lib/constants";

export interface BlogProps {
    /** The Firestore id of the post. Only published posts render; drafts and unknown ids count as "missing". */
    blogId: string;
    /** "On this page" links for posts with enough headings. Default: true. */
    showToc?: boolean;
    /** Cards for more posts under the article. Default: false, so embedding stays light. */
    showRelated?: boolean;
    /** Reader comments under the article (moderated). Default: false, so embedding stays light. */
    showComments?: boolean;
    /** Respond with the site's 404 page when the post is missing. Default: false (renders `fallback`). */
    notFoundIfMissing?: boolean;
    /** Shown instead of the post when it is missing. Default: nothing. */
    fallback?: ReactNode;
    /** Where the blog is mounted, for the links the article builds. Default: BLOG_BASE_PATH. */
    basePath?: string;
    className?: string;
}

/**
 * Renders one published post:
 *
 *     <Blog blogId="..." />
 *
 * A server component: it reads the post from Firestore with firebase-admin on the server and ships
 * plain HTML (the only client script is the code blocks' "Copy" button). Drop it into any route.
 */
export async function Blog({ blogId, showToc = true, showRelated = false, showComments = false, notFoundIfMissing = false, fallback = null, basePath = BLOG_BASE_PATH, className }: BlogProps) {
    const blog = await getPublishedBlog(blogId);

    if (!blog) {
        if (notFoundIfMissing) notFound();
        return <>{fallback}</>;
    }

    const related = showRelated ? await getRelatedBlogs(blog) : [];

    return (
        <>
            <BlogJsonLd blog={blog} />
            <BlogArticle
                blog={blog}
                related={related}
                comments={showComments ? <BlogComments blogId={blog.id} /> : undefined}
                showToc={showToc}
                basePath={basePath}
                className={className}
            />
        </>
    );
}
