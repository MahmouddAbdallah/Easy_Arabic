import { z } from "zod";
import { COMMENT_LIMITS, COMMENT_ADMIN_PAGE_SIZE, MAX_PAGE_SIZE } from "./constants";
import { cleanBody, cleanLine, hasLink, rejectionReason } from "./comment-text";
import { COMMENT_STATUSES, type CommentAdminQuery, type CommentStatusFilter } from "./comment-types";
import { isValidBlogId } from "./mappers";

/**
 * Request schemas for the comment endpoints. Like the post schemas, zod stays on the server. Text is
 * cleaned BEFORE its length is checked, so what is validated is exactly what would be stored.
 */

const nameField = z
    .string()
    .max(COMMENT_LIMITS.name * 4, "That name is too long.")
    .transform(cleanLine)
    .pipe(
        z
            .string()
            .min(1, "Please enter your name.")
            .max(COMMENT_LIMITS.name, `Keep your name under ${COMMENT_LIMITS.name} characters.`)
            .refine((name) => !hasLink(name), "Please use your name, not a web address.")
    );

/** Optional. Kept private (only the dashboard can see it) and used for nothing else. */
const emailField = z
    .string()
    .max(COMMENT_LIMITS.email * 2, "That email address is too long.")
    .transform((value) => cleanLine(value).toLowerCase())
    .pipe(
        z
            .string()
            .max(COMMENT_LIMITS.email, "That email address is too long.")
            .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email address.")
    );

const bodyField = z
    .string()
    // Cap before cleaning so a huge payload is never processed; the real limit is checked after.
    .max(COMMENT_LIMITS.body * 4, `Keep your comment under ${COMMENT_LIMITS.body} characters.`)
    .transform(cleanBody)
    .pipe(
        z
            .string()
            .min(COMMENT_LIMITS.minBody, "Please write a few words.")
            .max(COMMENT_LIMITS.body, `Keep your comment under ${COMMENT_LIMITS.body} characters.`)
    );

/** POST /api/blog/:blogId/comments: what a visitor sends. */
export const CreateCommentSchema = z.object({
    name: nameField,
    email: emailField.optional().default(""),
    body: bodyField.superRefine((body, ctx) => {
        const reason = rejectionReason(body);
        if (reason) ctx.addIssue({ code: "custom", message: reason });
    }),
    /** Signed when the page was rendered; proves the form came from the post and had time to be filled in. */
    token: z.string().max(200).default(""),
    /** Honeypot. A person never sees this field, so any value means a script filled it in. */
    website: z.string().max(500).optional().default(""),
});
export type CreateCommentInput = z.output<typeof CreateCommentSchema>;

/** POST /api/blog/comments/:commentId/replies: an admin reply. Replies skip the spam heuristics: they are the admin's own words. */
export const CreateReplySchema = z.object({
    body: bodyField,
});
export type CreateReplyInput = z.output<typeof CreateReplySchema>;

/** PATCH /api/blog/comments/:commentId: approve (publish) or send back to pending (unpublish). */
export const UpdateCommentSchema = z.object({
    status: z.enum(COMMENT_STATUSES),
});
export type UpdateCommentInput = z.output<typeof UpdateCommentSchema>;

const toPositiveInt = (value: string | null, fallback: number, max = Number.MAX_SAFE_INTEGER) => {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};

/** GET /api/blog/comments?page=&pageSize=&search=&status=pending|approved|all&blogId= (parsed by hand, like the post list). */
export function parseCommentListQuery(params: URLSearchParams): CommentAdminQuery {
    const rawStatus = params.get("status");
    const status: CommentStatusFilter = rawStatus === "pending" || rawStatus === "approved" ? rawStatus : "all";
    const blogId = params.get("blogId") ?? "";
    return {
        page: toPositiveInt(params.get("page"), 1),
        pageSize: toPositiveInt(params.get("pageSize"), COMMENT_ADMIN_PAGE_SIZE, MAX_PAGE_SIZE),
        search: (params.get("search") ?? "").slice(0, 100),
        status,
        blogId: isValidBlogId(blogId) ? blogId : "",
    };
}
