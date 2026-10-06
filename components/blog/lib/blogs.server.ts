/**
 * SERVER ONLY. The Blog's data layer: every Firestore read and write goes through here, so the
 * storage details (collections, field shapes, indexes, transactions) live in exactly one file.
 *
 *   blogs/{blogId}        the post
 *   blogSlugs/{slug}      { blogId }: reserves a slug. Created/deleted in the same transaction as the
 *                         post, which is what makes slugs unique (Firestore has no unique constraint).
 *
 * Reads never use composite indexes: lists order by one field, and filtering happens in memory over a
 * lean projection. See ADMIN_SCAN_LIMIT / PUBLIC_SCAN_LIMIT in ./constants.
 */
import { cache } from "react";
import { Timestamp } from "firebase-admin/firestore";
import { firebaseAdminDB } from "@/lib/config/firebase-admin";
import {
    ADMIN_SCAN_LIMIT,
    BLOG_COLLECTION,
    BLOG_CONTENT_VERSION,
    BLOG_SLUG_COLLECTION,
    PUBLIC_SCAN_LIMIT,
} from "./constants";
import {
    analyzeDocument,
    createEmptyDoc,
    deriveExcerpt,
    parseStoredContent,
    sanitizeDocument,
    type DocAnalysis,
} from "./content";
import { BlogApiError } from "./http.server";
import { buildAdminList, buildPublicList, pickRelated } from "./listing";
import {
    SUMMARY_FIELDS,
    isPubliclyVisible,
    isValidBlogId,
    recordFromData,
    summaryFromData,
} from "./mappers";
import { firstFreeSlug, isValidSlug, slugify } from "./slug";
import { normalizeCategory, normalizeTags } from "./taxonomy";
import type {
    BlogAdminList,
    BlogAdminQuery,
    BlogAuthor,
    BlogImage,
    BlogPublicList,
    BlogRecord,
    BlogSeo,
    BlogSummary,
} from "./types";
import type { CreateBlogInput, UpdateBlogInput } from "./schemas";

type Data = Record<string, unknown>;

const blogsCollection = () => firebaseAdminDB.collection(BLOG_COLLECTION);
const slugsCollection = () => firebaseAdminDB.collection(BLOG_SLUG_COLLECTION);

const EMPTY_SEO: BlogSeo = { title: "", description: "", canonicalUrl: "", noIndex: false };

/* ======================================================================= */
/* Admin (dashboard)                                                        */
/* ======================================================================= */

/** Every post, newest edit first, as lean summaries, filtered and paginated for the dashboard table. */
export async function listBlogsForAdmin(query: BlogAdminQuery): Promise<BlogAdminList> {
    const snapshot = await blogsCollection()
        .orderBy("updatedAt", "desc")
        .limit(ADMIN_SCAN_LIMIT)
        .select(...SUMMARY_FIELDS)
        .get();

    const truncated = snapshot.size >= ADMIN_SCAN_LIMIT;
    if (truncated) console.warn(`Blog: the dashboard list is capped at ${ADMIN_SCAN_LIMIT} posts; older posts are not listed.`);

    const all = snapshot.docs.map((doc) => summaryFromData(doc.id, doc.data()));
    return buildAdminList(all, query, { truncated });
}

/** A whole post (any status) for the editor. */
export async function getBlogForAdmin(blogId: string): Promise<BlogRecord | null> {
    if (!isValidBlogId(blogId)) return null;
    const snapshot = await blogsCollection().doc(blogId).get();
    return snapshot.exists ? recordFromData(snapshot.id, snapshot.data() as Data) : null;
}

export async function blogExists(blogId: string): Promise<boolean> {
    if (!isValidBlogId(blogId)) return false;
    return (await blogsCollection().doc(blogId).get()).exists;
}

/** Starts a draft with a slug derived from the title (made unique if needed). */
export async function createBlog(input: CreateBlogInput, author: BlogAuthor): Promise<BlogRecord> {
    const ref = blogsCollection().doc();
    const now = Timestamp.now();

    const data = await firebaseAdminDB.runTransaction(async (tx) => {
        // Reads first: a transaction must finish reading before it writes.
        const slug = await firstFreeSlug(slugify(input.title), async (candidate) => {
            const taken = await tx.get(slugsCollection().doc(candidate));
            return taken.exists;
        });

        const doc: Data = {
            title: input.title,
            slug,
            status: "draft",
            excerpt: "",
            autoExcerpt: "",
            category: null,
            tags: [],
            coverImage: null,
            content: JSON.stringify(createEmptyDoc()),
            contentVersion: BLOG_CONTENT_VERSION,
            seo: EMPTY_SEO,
            author: { id: author.id, name: author.name },
            readingTime: 1,
            wordCount: 0,
            createdAt: now,
            updatedAt: now,
            publishedAt: null,
        };

        tx.set(ref, doc);
        tx.set(slugsCollection().doc(slug), { blogId: ref.id });
        return doc;
    });

    return recordFromData(ref.id, data);
}

export interface UpdateBlogResult {
    blog: BlogRecord;
    /** The slug before this update, so the caller can refresh the old URL too. */
    previousSlug: string;
}

/** Removes `undefined` (Firestore rejects it) from a cover image and keeps only the known fields. */
function toStoredCover(cover: NonNullable<UpdateBlogInput["coverImage"]>): BlogImage {
    return {
        url: cover.url,
        alt: cover.alt,
        ...(cover.publicId ? { publicId: cover.publicId } : {}),
        ...(cover.width ? { width: cover.width } : {}),
        ...(cover.height ? { height: cover.height } : {}),
    };
}

/**
 * Applies a partial update in one transaction: conflict check, slug reservation, derived fields
 * (reading time, excerpt…) and publish/unpublish rules all happen against the same snapshot.
 */
export async function updateBlog(blogId: string, patch: UpdateBlogInput): Promise<UpdateBlogResult> {
    if (!isValidBlogId(blogId)) throw new BlogApiError("NOT_FOUND", "That post doesn't exist.", 404);

    // Sanitize before opening the transaction: it's CPU work and can reject the request outright.
    const newContent = patch.content === undefined ? undefined : sanitizeDocument(patch.content);
    const newAnalysis = newContent ? analyzeDocument(newContent) : undefined;

    const ref = blogsCollection().doc(blogId);

    return firebaseAdminDB.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists) throw new BlogApiError("NOT_FOUND", "That post doesn't exist.", 404);
        const current = snapshot.data() as Data;
        const currentSummary = summaryFromData(blogId, current);

        if (patch.baseUpdatedAt && patch.baseUpdatedAt !== currentSummary.updatedAt) {
            throw new BlogApiError(
                "EDIT_CONFLICT",
                "This post was changed somewhere else since you opened it. Copy your edits, reload, and apply them again.",
                409
            );
        }

        const updates: Data = {};
        const title = patch.title ?? currentSummary.title;
        if (patch.title !== undefined) updates.title = patch.title;

        // --- slug (reads happen before any write)
        let slugWrites: (() => void) | null = null;
        if (patch.slug !== undefined) {
            const requested = slugify(patch.slug) || slugify(title) || "post";
            if (!isValidSlug(requested)) {
                throw new BlogApiError("VALIDATION_ERROR", "That address can't be used.", 400, { slug: ["That address can't be used."] });
            }
            if (requested !== currentSummary.slug) {
                const reservation = await tx.get(slugsCollection().doc(requested));
                if (reservation.exists && reservation.get("blogId") !== blogId) {
                    throw new BlogApiError("SLUG_TAKEN", "Another post already uses that address.", 409, {
                        slug: ["Another post already uses that address."],
                    });
                }
                const oldReservation = currentSummary.slug ? slugsCollection().doc(currentSummary.slug) : null;
                slugWrites = () => {
                    tx.set(slugsCollection().doc(requested), { blogId });
                    if (oldReservation) tx.delete(oldReservation);
                };
                updates.slug = requested;
            }
        }

        // --- plain fields
        if (patch.excerpt !== undefined) updates.excerpt = patch.excerpt;
        if (patch.category !== undefined) updates.category = normalizeCategory(patch.category);
        if (patch.tags !== undefined) updates.tags = normalizeTags(patch.tags);
        if (patch.coverImage !== undefined) updates.coverImage = patch.coverImage ? toStoredCover(patch.coverImage) : null;
        if (patch.seo !== undefined) updates.seo = patch.seo;

        // --- content and what is derived from it
        let analysis: DocAnalysis | undefined = newAnalysis;
        if (newContent && newAnalysis) {
            updates.content = JSON.stringify(newContent);
            updates.contentVersion = BLOG_CONTENT_VERSION;
            updates.wordCount = newAnalysis.wordCount;
            updates.readingTime = newAnalysis.readingTime;
            updates.autoExcerpt = deriveExcerpt(newAnalysis.text);
        } else if (patch.status === "published" || currentSummary.status === "published") {
            analysis = analyzeDocument(parseStoredContent(current.content, blogId));
        }

        // --- publish / unpublish
        const finalStatus = patch.status ?? currentSummary.status;
        if (finalStatus === "published") {
            // Also enforced on edits of an already-published post, so it can't be emptied by accident.
            if (!title.trim()) throw new BlogApiError("NOT_PUBLISHABLE", "Add a title before publishing.", 422);
            if (!analysis || analysis.isEmpty) throw new BlogApiError("NOT_PUBLISHABLE", "Write something before publishing.", 422);
        }
        if (finalStatus !== currentSummary.status) {
            updates.status = finalStatus;
            updates.publishedAt = finalStatus === "published" ? Timestamp.now() : null;
        }

        const updatedAt = Timestamp.now();
        updates.updatedAt = updatedAt;

        // --- writes
        slugWrites?.();
        tx.update(ref, updates);

        return {
            blog: recordFromData(blogId, { ...current, ...updates }),
            previousSlug: currentSummary.slug,
        };
    });
}

/** Deletes the post and its slug reservation. Returns the deleted post (the caller refreshes its public URL). */
export async function deleteBlog(blogId: string): Promise<{ blog: BlogSummary }> {
    if (!isValidBlogId(blogId)) throw new BlogApiError("NOT_FOUND", "That post doesn't exist.", 404);
    const ref = blogsCollection().doc(blogId);

    return firebaseAdminDB.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists) throw new BlogApiError("NOT_FOUND", "That post doesn't exist.", 404);

        const record = recordFromData(blogId, snapshot.data() as Data);
        const reservationRef = record.slug ? slugsCollection().doc(record.slug) : null;
        const reservation = reservationRef ? await tx.get(reservationRef) : null;

        tx.delete(ref);
        // Only release the slug if it really is this post's reservation.
        if (reservationRef && reservation?.exists && reservation.get("blogId") === blogId) tx.delete(reservationRef);

        return { blog: record };
    });
}

/* ======================================================================= */
/* Public (visitors)                                                        */
/* ======================================================================= */
/*
 * Everything below is wrapped in React's `cache()`: within one request, `generateMetadata`, the page
 * and any component asking for the same data share a single Firestore read.
 */

const getPublishedIndex = cache(async (): Promise<{ blogs: BlogSummary[]; truncated: boolean }> => {
    const snapshot = await blogsCollection()
        // A range filter and ordering on the same single field: served by the automatic index.
        // Drafts have `publishedAt: null`, which a timestamp comparison never matches.
        .where("publishedAt", "<=", Timestamp.now())
        .orderBy("publishedAt", "desc")
        .limit(PUBLIC_SCAN_LIMIT)
        .select(...SUMMARY_FIELDS)
        .get();

    const truncated = snapshot.size >= PUBLIC_SCAN_LIMIT;
    if (truncated) console.warn(`Blog: the public list is capped at the newest ${PUBLIC_SCAN_LIMIT} posts.`);

    const blogs = snapshot.docs.map((doc) => summaryFromData(doc.id, doc.data())).filter((blog) => isPubliclyVisible(blog));
    return { blogs, truncated };
});

/** One page of published posts, optionally narrowed to a category or tag (by slug). */
export async function listPublishedBlogs(query: {
    page: number;
    pageSize: number;
    category?: string;
    tag?: string;
}): Promise<BlogPublicList> {
    const { blogs, truncated } = await getPublishedIndex();
    return buildPublicList(blogs, query, { truncated });
}

/** A published post by id, or `null` for a draft, a missing post or an invalid id. */
export const getPublishedBlog = cache(async (blogId: string): Promise<BlogRecord | null> => {
    if (!isValidBlogId(blogId)) return null;
    const snapshot = await blogsCollection().doc(blogId).get();
    if (!snapshot.exists) return null;
    const blog = recordFromData(snapshot.id, snapshot.data() as Data);
    return isPubliclyVisible(blog) ? blog : null;
});

/** The id of the published post with this slug, or `null`. Only reads the two fields it needs. */
export const resolvePublishedBlogId = cache(async (slug: string): Promise<string | null> => {
    if (!isValidSlug(slug)) return null;
    const snapshot = await blogsCollection().where("slug", "==", slug).limit(1).select("status", "publishedAt").get();
    const doc = snapshot.docs[0];
    if (!doc) return null;
    const { status, publishedAt } = summaryFromData(doc.id, doc.data());
    return isPubliclyVisible({ status, publishedAt }) ? doc.id : null;
});

/** Posts to suggest after `current`, from the same cached index the list uses. */
export async function getRelatedBlogs(
    current: Pick<BlogSummary, "id" | "category" | "tags">,
    limit = 3
): Promise<BlogSummary[]> {
    const { blogs } = await getPublishedIndex();
    return pickRelated(blogs, current, limit);
}
