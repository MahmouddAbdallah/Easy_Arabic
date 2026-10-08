/**
 * Types shared by the server, the public article page and the dashboard. Types only (no runtime
 * code), so importing this never pulls server code into the browser.
 */

/** A comment waits as `pending` until an admin approves it; only `approved` ones are public. */
export const COMMENT_STATUSES = ["pending", "approved"] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];

/** `visitor`: a reader's comment. `admin`: a reply posted from the dashboard. */
export type CommentKind = "visitor" | "admin";

/** One comment as visitors see it. Never carries an email, a status or anything about the author's device. */
export interface PublicComment {
    id: string;
    kind: CommentKind;
    authorName: string;
    body: string;
    /** ISO date. */
    createdAt: string;
    replies: PublicComment[];
}

/** One comment as the dashboard sees it. */
export interface AdminComment {
    id: string;
    blogId: string;
    /** `null` when the post has since been deleted (its comments are removed with it, so this is rare). */
    blogTitle: string | null;
    blogSlug: string | null;
    parentId: string | null;
    kind: CommentKind;
    status: CommentStatus;
    authorName: string;
    /** Only the dashboard ever sees this. */
    authorEmail: string | null;
    body: string;
    createdAt: string;
    replies: AdminComment[];
}

export type CommentStatusFilter = CommentStatus | "all";

export interface CommentAdminQuery {
    page: number;
    pageSize: number;
    search: string;
    status: CommentStatusFilter;
    /** Only comments on this post. */
    blogId: string;
}

export interface CommentCounts {
    pending: number;
    approved: number;
    all: number;
}

/** Top-level comments (each with its replies) for one page of the dashboard list. */
export interface CommentAdminList {
    comments: AdminComment[];
    counts: CommentCounts;
    pagination: { page: number; pageSize: number; total: number; pageCount: number };
    /** True when there are more comments than one request reads; the oldest ones are left out. */
    truncated: boolean;
}

/** What the public form sends. */
export interface CommentSubmission {
    name: string;
    email: string;
    body: string;
    token: string;
    /** Honeypot: always empty from a real browser. */
    website: string;
}
