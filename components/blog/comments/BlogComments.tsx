import { MessageCircle } from "lucide-react";
import { getPublicComments, createCommentFormToken } from "../lib/comments.server";
import { CommentForm } from "./CommentForm";
import { CommentThread } from "./CommentThread";

interface BlogCommentsProps {
    blogId: string;
}

/**
 * The comments section under a published post: the approved comments (with the site's replies) and the
 * form to add one. A server component. It issues the form's signed token, so it must be rendered per
 * request (the blog pages are `force-dynamic`), never baked into a static page.
 */
export async function BlogComments({ blogId }: BlogCommentsProps) {
    const { threads, count } = await getPublicComments(blogId);

    return (
        <section id="comments" aria-labelledby="blog-comments-title" className="mt-12 scroll-mt-24 border-t border-border pt-10">
            <h2 id="blog-comments-title" className="mb-6 flex items-baseline gap-2.5 font-display text-2xl font-bold tracking-tight text-foreground md:text-[1.75rem]">
                Comments
                {count > 0 && <span className="text-lg font-semibold text-muted-foreground tabular-nums">({count})</span>}
            </h2>

            {threads.length > 0 ? (
                <CommentThread comments={threads} />
            ) : (
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-5 text-muted-foreground">
                    <MessageCircle aria-hidden className="size-5 shrink-0" />
                    <p className="text-[0.95rem]">No comments yet. Be the first to share what you think.</p>
                </div>
            )}

            <div className="relative mt-10">
                <CommentForm blogId={blogId} token={createCommentFormToken(blogId)} />
            </div>
        </section>
    );
}
