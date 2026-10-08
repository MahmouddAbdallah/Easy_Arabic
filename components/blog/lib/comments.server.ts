/**
 * SERVER ONLY. The comment system's data layer: every Firestore read and write for reader comments
 * goes through here (same role as ./blogs.server for posts).
 *
 *   blogComments/{commentId}   a reader's comment, or an admin's reply to one
 *
 * A comment is created `pending` and is invisible to visitors until an admin approves it. Admin
 * replies are created `approved` (an admin wrote them) under an already-approved comment.
 *
 * Reads are equality-only and sorted in memory, so none of them needs a composite index. Fields that
 * must never reach a visitor (email, the hashed IP, the duplicate fingerprint) are left out of every
 * public read with `.select()`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { Timestamp } from "firebase-admin/firestore";
import { firebaseAdminDB } from "@/lib/config/firebase-admin";
import { duplicateKey } from "./comment-text";
import { buildAdminList, buildPublicThreads, countPublicComments, type CommentRow, type PostLabel } from "./comment-threads";
import type { CommentAdminList, CommentAdminQuery, CommentStatus, PublicComment } from "./comment-types";
import type { CreateCommentInput, CreateReplyInput } from "./comment-schemas";
import {
    BLOG_COLLECTION,
    BLOG_COMMENT_COLLECTION,
    COMMENT_ADMIN_SCAN_LIMIT,
    COMMENT_ANTISPAM,
    COMMENT_PUBLIC_SCAN_LIMIT,
    COMMENT_SITE_NAME,
} from "./constants";
import { BlogApiError } from "./http.server";
import { isPubliclyVisible, isValidBlogId } from "./mappers";
import type { BlogAuthor } from "./types";

type Data = Record<string, unknown>;

const commentsCollection = () => firebaseAdminDB.collection(BLOG_COMMENT_COLLECTION);

const asString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);

/** Fields every read needs. Deliberately excludes `ipHash` and `duplicateHash`. */
const ROW_FIELDS = ["blogId", "parentId", "kind", "status", "authorName", "authorEmail", "body", "createdAt"] as const;

function rowFromData(id: string, data: Data): CommentRow {
    const createdAt = data.createdAt;
    return {
        id,
        blogId: asString(data.blogId),
        parentId: typeof data.parentId === "string" ? data.parentId : null,
        kind: data.kind === "admin" ? "admin" : "visitor",
        status: data.status === "approved" ? "approved" : "pending",
        authorName: asString(data.authorName, "Anonymous"),
        authorEmail: typeof data.authorEmail === "string" && data.authorEmail ? data.authorEmail : null,
        body: asString(data.body),
        createdAtMs: createdAt instanceof Timestamp ? createdAt.toMillis() : 0,
    };
}

/* ======================================================================= */
/* Anti-spam: the signed form token                                         */
/* ======================================================================= */

/*
 * The article page signs `blogId + time` when it renders the comment form; the endpoint checks it.
 * That proves, without any database or cookie, that (1) the request belongs to a form that was
 * served for this post, (2) the form existed for at least a few seconds (scripts post instantly), and
 * (3) it isn't a form from last week. It is one layer among several (see COMMENT_ANTISPAM), not a CAPTCHA.
 */

export type FormTokenCheck = "ok" | "invalid" | "expired" | "too_fast";

const signToken = (blogId: string, issuedAtMs: number) =>
    createHmac("sha256", `${process.env.JWT_SECRET || "dev-only"}:blog-comment-form`)
        .update(`${blogId}.${issuedAtMs}`)
        .digest("base64url")
        .slice(0, 32);

export const createCommentFormToken = (blogId: string, now: number = Date.now()) => `${now}.${signToken(blogId, now)}`;

export function checkCommentFormToken(blogId: string, token: string, now: number = Date.now()): FormTokenCheck {
    const [issued, signature, ...rest] = token.split(".");
    const issuedAtMs = Number(issued);
    if (rest.length || !signature || !Number.isInteger(issuedAtMs) || issuedAtMs <= 0) return "invalid";

    const expected = Buffer.from(signToken(blogId, issuedAtMs));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return "invalid";

    const ageSeconds = (now - issuedAtMs) / 1000;
    if (ageSeconds < 0) return "invalid";
    if (ageSeconds < COMMENT_ANTISPAM.minFillSeconds) return "too_fast";
    if (ageSeconds > COMMENT_ANTISPAM.tokenMaxAgeSeconds) return "expired";
    return "ok";
}

/* ======================================================================= */
/* Public (visitors)                                                        */
/* ======================================================================= */

/** Approved comments on a post, as threads (oldest first), plus how many a visitor can see. Cached per request. */
export const getPublicComments = cache(
    async (blogId: string): Promise<{ threads: PublicComment[]; count: number }> => {
        if (!isValidBlogId(blogId)) return { threads: [], count: 0 };

        const snapshot = await commentsCollection()
            .where("blogId", "==", blogId)
            .where("status", "==", "approved")
            .limit(COMMENT_PUBLIC_SCAN_LIMIT)
            // No email, no status: a visitor only ever gets name, text and date.
            .select("blogId", "parentId", "kind", "status", "authorName", "body", "createdAt")
            .get();

        if (snapshot.size >= COMMENT_PUBLIC_SCAN_LIMIT) {
            console.warn(`Comments: a post has more than ${COMMENT_PUBLIC_SCAN_LIMIT} approved comments; the rest are not shown.`);
        }

        const threads = buildPublicThreads(snapshot.docs.map((doc) => rowFromData(doc.id, doc.data())));
        return { threads, count: countPublicComments(threads) };
    }
);

/**
 * Stores a visitor's comment as `pending`. The caller has already validated the request, checked the
 * token and applied the per-IP rate limits; this enforces the limits that need the database: a
 * visitor (or a flood) can't fill the moderation queue, and the same comment can't be posted twice.
 */
export async function createVisitorComment(blogId: string, input: CreateCommentInput, ipHash: string): Promise<{ id: string }> {
    const duplicateHash = createHmac("sha256", `${process.env.JWT_SECRET || "dev-only"}:blog-comment-duplicate`)
        .update(`${blogId}\n${duplicateKey(input.body)}`)
        .digest("hex")
        .slice(0, 40);

    const comments = commentsCollection();
    const [pendingOnPost, pendingFromIp, duplicate] = await Promise.all([
        comments.where("blogId", "==", blogId).where("status", "==", "pending").count().get(),
        comments.where("ipHash", "==", ipHash).where("status", "==", "pending").count().get(),
        comments.where("blogId", "==", blogId).where("duplicateHash", "==", duplicateHash).limit(1).select().get(),
    ]);

    if (!duplicate.empty) {
        throw new BlogApiError("DUPLICATE_COMMENT", "You've already sent this comment. It will appear once it has been reviewed.", 409);
    }
    if (pendingFromIp.data().count >= COMMENT_ANTISPAM.maxPendingPerIp) {
        throw new BlogApiError(
            "TOO_MANY_PENDING",
            "You already have several comments waiting for review. Please wait until they have been looked at before sending more.",
            429
        );
    }
    if (pendingOnPost.data().count >= COMMENT_ANTISPAM.maxPendingPerPost) {
        throw new BlogApiError("COMMENTS_BUSY", "This post has a lot of comments waiting for review right now. Please try again later.", 429);
    }

    const now = Timestamp.now();
    const ref = comments.doc();
    await ref.set({
        blogId,
        parentId: null,
        kind: "visitor",
        status: "pending",
        authorName: input.name,
        authorEmail: input.email || null,
        authorUserId: null,
        body: input.body,
        duplicateHash,
        ipHash,
        createdAt: now,
        updatedAt: now,
        moderatedAt: null,
        moderatedBy: null,
    });
    return { id: ref.id };
}

/* ======================================================================= */
/* Admin (dashboard)                                                        */
/* ======================================================================= */

/** Title/slug/published-state of the posts the given comments belong to, in one batched read. */
async function loadPostLabels(blogIds: string[]): Promise<Map<string, PostLabel>> {
    const labels = new Map<string, PostLabel>();
    const ids = [...new Set(blogIds)].filter(isValidBlogId);
    if (!ids.length) return labels;

    const refs = ids.map((id) => firebaseAdminDB.collection(BLOG_COLLECTION).doc(id));
    const snapshots = await firebaseAdminDB.getAll(...refs, { fieldMask: ["title", "slug", "status", "publishedAt"] });
    for (const snapshot of snapshots) {
        if (!snapshot.exists) continue;
        const publishedAt = snapshot.get("publishedAt");
        const visible = isPubliclyVisible({
            status: snapshot.get("status") === "published" ? "published" : "draft",
            publishedAt: publishedAt instanceof Timestamp ? publishedAt.toDate().toISOString() : null,
        });
        labels.set(snapshot.id, { title: asString(snapshot.get("title"), "Untitled"), slug: visible ? asString(snapshot.get("slug")) || null : null });
    }
    return labels;
}

/** Everything the dashboard list needs, newest first: one lean read, then filtering and paging in memory. */
export async function listCommentsForAdmin(query: CommentAdminQuery): Promise<CommentAdminList> {
    const snapshot = await commentsCollection()
        .orderBy("createdAt", "desc")
        .limit(COMMENT_ADMIN_SCAN_LIMIT)
        .select(...ROW_FIELDS)
        .get();

    const truncated = snapshot.size >= COMMENT_ADMIN_SCAN_LIMIT;
    if (truncated) console.warn(`Comments: the dashboard list is capped at the newest ${COMMENT_ADMIN_SCAN_LIMIT} comments.`);

    const rows = snapshot.docs.map((doc) => rowFromData(doc.id, doc.data()));
    const posts = await loadPostLabels(rows.map((row) => row.blogId));
    return buildAdminList(rows, query, posts, truncated);
}

/** How many comments are waiting for review (the badge in the sidebar). */
export async function countPendingComments(): Promise<number> {
    const result = await commentsCollection().where("status", "==", "pending").count().get();
    return result.data().count;
}

/**
 * Approve (publish) a comment, or send it back to pending (unpublish). Replies to a comment that is
 * not approved are hidden with it, so un-approving never leaves a reply floating on its own.
 */
export async function setCommentStatus(commentId: string, status: CommentStatus, admin: BlogAuthor): Promise<{ id: string; status: CommentStatus }> {
    if (!isValidBlogId(commentId)) throw new BlogApiError("NOT_FOUND", "That comment doesn't exist.", 404);
    const ref = commentsCollection().doc(commentId);

    return firebaseAdminDB.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists) throw new BlogApiError("NOT_FOUND", "That comment doesn't exist.", 404);
        if (snapshot.get("kind") === "admin") {
            throw new BlogApiError("INVALID_ACTION", "Replies are published when you post them. Delete the reply to remove it.", 400);
        }

        const now = Timestamp.now();
        tx.update(ref, {
            status,
            updatedAt: now,
            moderatedAt: now,
            moderatedBy: admin.id,
        });
        return { id: commentId, status };
    });
}

/** Posts an admin reply under an approved comment. The reply is public immediately. */
export async function createAdminReply(commentId: string, input: CreateReplyInput, admin: BlogAuthor): Promise<{ id: string; blogId: string }> {
    if (!isValidBlogId(commentId)) throw new BlogApiError("NOT_FOUND", "That comment doesn't exist.", 404);
    const parentRef = commentsCollection().doc(commentId);
    const replyRef = commentsCollection().doc();

    return firebaseAdminDB.runTransaction(async (tx) => {
        const parent = await tx.get(parentRef);
        if (!parent.exists) throw new BlogApiError("NOT_FOUND", "That comment doesn't exist.", 404);
        if (parent.get("kind") !== "visitor" || parent.get("parentId") !== null) {
            throw new BlogApiError("INVALID_ACTION", "You can only reply to a reader's comment.", 400);
        }
        if (parent.get("status") !== "approved") {
            // A reply under a hidden comment would be invisible too. Approve first, then reply.
            throw new BlogApiError("COMMENT_NOT_APPROVED", "Approve the comment before replying to it.", 409);
        }

        const blogId = asString(parent.get("blogId"));
        const now = Timestamp.now();
        tx.set(replyRef, {
            blogId,
            parentId: commentId,
            kind: "admin",
            status: "approved",
            // What visitors see. The admin's own name is kept only for the record.
            authorName: COMMENT_SITE_NAME,
            authorEmail: null,
            authorUserId: admin.id,
            authorUserName: admin.name,
            body: input.body,
            duplicateHash: null,
            ipHash: null,
            createdAt: now,
            updatedAt: now,
            moderatedAt: now,
            moderatedBy: admin.id,
        });
        return { id: replyRef.id, blogId };
    });
}

/** Deletes a comment together with every reply under it. Used for "reject" and for deleting published comments. */
export async function deleteComment(commentId: string): Promise<{ deleted: number }> {
    if (!isValidBlogId(commentId)) throw new BlogApiError("NOT_FOUND", "That comment doesn't exist.", 404);
    const ref = commentsCollection().doc(commentId);

    const [snapshot, replies] = await Promise.all([ref.get(), commentsCollection().where("parentId", "==", commentId).select().get()]);
    if (!snapshot.exists) throw new BlogApiError("NOT_FOUND", "That comment doesn't exist.", 404);

    const batch = firebaseAdminDB.batch();
    batch.delete(ref);
    replies.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    return { deleted: 1 + replies.size };
}

/** Removes every comment on a post. Called after the post itself is deleted; never throws into the request. */
export async function deleteCommentsForBlog(blogId: string): Promise<void> {
    try {
        // Firestore batches hold up to 500 writes; loop until nothing is left.
        for (;;) {
            const snapshot = await commentsCollection().where("blogId", "==", blogId).limit(400).select().get();
            if (snapshot.empty) return;
            const batch = firebaseAdminDB.batch();
            snapshot.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
            if (snapshot.size < 400) return;
        }
    } catch (error) {
        console.error(`Comments: could not remove the comments of deleted post ${blogId}:`, error);
    }
}
