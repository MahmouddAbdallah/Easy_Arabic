/**
 * Turning the flat list of stored comments into the nested shape each screen needs. Pure functions
 * (no I/O), so the rules are easy to read and test:
 *
 *   - Visitors see only approved comments, each with the admin replies under it.
 *   - A reply is shown only while the comment it answers is shown: un-approving a comment hides its
 *     replies with it, and a reply whose parent no longer exists is dropped.
 *   - Threads are one level deep: a comment and the replies to it.
 */
import type {
    AdminComment,
    CommentAdminList,
    CommentAdminQuery,
    CommentCounts,
    CommentStatus,
    PublicComment,
} from "./comment-types";
import type { CommentKind } from "./comment-types";

/** The fields of a stored comment the builders below need (the data layer maps documents to this). */
export interface CommentRow {
    id: string;
    blogId: string;
    parentId: string | null;
    kind: CommentKind;
    status: CommentStatus;
    authorName: string;
    authorEmail: string | null;
    body: string;
    /** Milliseconds since the epoch. */
    createdAtMs: number;
}

const byOldestFirst = (a: CommentRow, b: CommentRow) => a.createdAtMs - b.createdAtMs || a.id.localeCompare(b.id);
const byNewestFirst = (a: CommentRow, b: CommentRow) => b.createdAtMs - a.createdAtMs || a.id.localeCompare(b.id);

const isoDate = (ms: number) => new Date(ms).toISOString();

/** Group replies by the comment they answer. */
function repliesByParent(rows: CommentRow[]): Map<string, CommentRow[]> {
    const map = new Map<string, CommentRow[]>();
    for (const row of rows) {
        if (!row.parentId) continue;
        const list = map.get(row.parentId) ?? [];
        list.push(row);
        map.set(row.parentId, list);
    }
    return map;
}

/** Approved comments of one post, oldest first, with their admin replies (oldest first) nested under them. */
export function buildPublicThreads(rows: CommentRow[]): PublicComment[] {
    const approved = rows.filter((row) => row.status === "approved");
    const replies = repliesByParent(approved);

    const toPublic = (row: CommentRow, nested: PublicComment[]): PublicComment => ({
        id: row.id,
        kind: row.kind,
        authorName: row.authorName,
        body: row.body,
        createdAt: isoDate(row.createdAtMs),
        replies: nested,
    });

    return approved
        .filter((row) => row.parentId === null && row.kind === "visitor")
        .sort(byOldestFirst)
        .map((row) =>
            toPublic(
                row,
                (replies.get(row.id) ?? [])
                    .filter((reply) => reply.kind === "admin")
                    .sort(byOldestFirst)
                    .map((reply) => toPublic(reply, []))
            )
        );
}

/** Number of comments a visitor can see on the post (comments + replies), for the "Comments (n)" heading. */
export const countPublicComments = (threads: PublicComment[]) =>
    threads.reduce((total, thread) => total + 1 + thread.replies.length, 0);

/** What the dashboard needs to label a comment with its post. */
export interface PostLabel {
    title: string;
    slug: string | null;
}

const matchesSearch = (row: CommentRow, needle: string, posts: Map<string, PostLabel>) => {
    if (!needle) return true;
    const haystack = [row.authorName, row.authorEmail ?? "", row.body, posts.get(row.blogId)?.title ?? ""].join("\n").toLowerCase();
    return haystack.includes(needle);
};

/**
 * One page of top-level visitor comments (newest first) for the dashboard, each with its replies.
 * `counts` are for the whole set (ignoring the search box and the status tab) so the tabs always
 * show the real numbers.
 */
export function buildAdminList(
    rows: CommentRow[],
    query: CommentAdminQuery,
    posts: Map<string, PostLabel>,
    truncated: boolean
): CommentAdminList {
    const scoped = query.blogId ? rows.filter((row) => row.blogId === query.blogId) : rows;
    const topLevel = scoped.filter((row) => row.parentId === null && row.kind === "visitor");
    const replies = repliesByParent(scoped);

    const counts: CommentCounts = {
        pending: topLevel.filter((row) => row.status === "pending").length,
        approved: topLevel.filter((row) => row.status === "approved").length,
        all: topLevel.length,
    };

    const needle = query.search.trim().toLowerCase();
    const matching = topLevel
        .filter((row) => query.status === "all" || row.status === query.status)
        .filter((row) => matchesSearch(row, needle, posts))
        // Pending ones are waiting on someone, so the oldest should be answered first; everything else is a history.
        .sort(query.status === "pending" ? byOldestFirst : byNewestFirst);

    const pageCount = Math.max(1, Math.ceil(matching.length / query.pageSize));
    const page = Math.min(Math.max(1, query.page), pageCount);
    const slice = matching.slice((page - 1) * query.pageSize, page * query.pageSize);

    const toAdmin = (row: CommentRow, nested: AdminComment[]): AdminComment => ({
        id: row.id,
        blogId: row.blogId,
        blogTitle: posts.get(row.blogId)?.title ?? null,
        blogSlug: posts.get(row.blogId)?.slug ?? null,
        parentId: row.parentId,
        kind: row.kind,
        status: row.status,
        authorName: row.authorName,
        authorEmail: row.authorEmail,
        body: row.body,
        createdAt: isoDate(row.createdAtMs),
        replies: nested,
    });

    return {
        comments: slice.map((row) =>
            toAdmin(
                row,
                (replies.get(row.id) ?? [])
                    .filter((reply) => reply.kind === "admin")
                    .sort(byOldestFirst)
                    .map((reply) => toAdmin(reply, []))
            )
        ),
        counts,
        pagination: { page, pageSize: query.pageSize, total: matching.length, pageCount },
        truncated,
    };
}
