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
        // The section's own words ("Leave a comment", labels, hints) are the site's English UI, so they stay left-to-right even under
        // an Arabic post: English sentences ending in a full stop get it on the wrong side in a right-to-left box. Each comment still
        // reads in its own direction (see CommentThread), and the form's fields detect theirs as you type.
        <section id="comments" dir="ltr" aria-labelledby="blog-comments-title" className="mt-14 scroll-mt-24 border-t border-border pt-10 md:mt-16">
            <h2 id="blog-comments-title" className="mb-6 flex items-center gap-3 font-display text-2xl font-bold tracking-tight text-foreground md:text-[1.75rem]">
                Comments
                {count > 0 && (
                    <span className="rounded-full bg-muted px-2.5 py-0.5 font-sans text-sm font-semibold text-muted-foreground tabular-nums">{count}</span>
                )}
            </h2>

            {threads.length > 0 ? (
                <CommentThread comments={threads} />
            ) : (
                <div className="flex items-center gap-4 rounded-2xl border border-dashed border-border bg-muted/30 p-5">
                    <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                        <MessageCircle className="size-5" />
                    </span>
                    <div>
                        <p className="font-medium text-foreground">No comments yet</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">Be the first to share what you think.</p>
                    </div>
                </div>
            )}

            <div className="relative mt-8 md:mt-10">
                <CommentForm blogId={blogId} token={createCommentFormToken(blogId)} />
            </div>
        </section>
    );
}
