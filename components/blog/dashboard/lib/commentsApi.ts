import axios from "axios";
import {
    BLOG_COMMENTS_API_URL,
    BLOG_COMMENTS_PENDING_COUNT_API_URL,
    blogCommentApiUrl,
    blogCommentRepliesApiUrl,
} from "@/components/blog/lib/constants";
import type { CommentAdminList, CommentAdminQuery, CommentStatus } from "@/components/blog/lib/comment-types";

/**
 * The Dashboard's door to the comment-moderation API (same role as ./blogApi for posts). Every change
 * announces itself on `window`, so the sidebar's "pending" badge updates without waiting for its next poll.
 */

export { isAborted, toApiFailure } from "./blogApi";

export const COMMENTS_CHANGED_EVENT = "blog-comments:changed";
const announceChange = () => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(COMMENTS_CHANGED_EVENT));
};

export async function fetchCommentList(query: CommentAdminQuery, signal?: AbortSignal): Promise<CommentAdminList> {
    const { data } = await axios.get<CommentAdminList>(BLOG_COMMENTS_API_URL, {
        params: {
            page: query.page,
            pageSize: query.pageSize,
            search: query.search || undefined,
            status: query.status === "all" ? undefined : query.status,
            blogId: query.blogId || undefined,
        },
        signal,
    });
    return { comments: data.comments, counts: data.counts, pagination: data.pagination, truncated: data.truncated };
}

/** Approve (publish) a comment, or send it back to pending. */
export async function setCommentStatus(commentId: string, status: CommentStatus): Promise<void> {
    await axios.patch(blogCommentApiUrl(commentId), { status });
    announceChange();
}

/** Reject a pending comment or delete a published one (replies go with it); also removes a single reply. */
export async function removeComment(commentId: string): Promise<void> {
    await axios.delete(blogCommentApiUrl(commentId));
    announceChange();
}

export async function replyToComment(commentId: string, body: string): Promise<void> {
    await axios.post(blogCommentRepliesApiUrl(commentId), { body });
    announceChange();
}

export async function fetchPendingCommentCount(signal?: AbortSignal): Promise<number> {
    const { data } = await axios.get<{ count: number }>(BLOG_COMMENTS_PENDING_COUNT_API_URL, { signal });
    return data.count;
}
