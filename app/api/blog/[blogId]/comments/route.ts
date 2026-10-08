import { NextRequest, NextResponse } from "next/server";
import { consume, rateLimitKey } from "@/lib/auth/rateLimit";
import { forbiddenOrigin, getClientIp, hashIdentifier, isSameOrigin, tooManyRequests } from "@/lib/auth/request";
import { getPublishedBlog } from "@/components/blog/lib/blogs.server";
import { CreateCommentSchema } from "@/components/blog/lib/comment-schemas";
import { checkCommentFormToken, createVisitorComment } from "@/components/blog/lib/comments.server";
import { COMMENT_ANTISPAM, COMMENT_HONEYPOT_FIELD } from "@/components/blog/lib/constants";
import { BlogApiError, errorResponse, handleRouteError, parsePublicBody } from "@/components/blog/lib/http.server";

export const runtime = "nodejs";

interface RouteParams {
    params: Promise<{ blogId: string }>;
}

const PENDING_MESSAGE = "Thanks! Your comment has been sent and will appear once it has been reviewed.";

/**
 * POST /api/blog/:blogId/comments { name, email?, body, token, website }
 *
 * The one endpoint in the Blog anyone can call, so it is layered. In order:
 *   1. same-origin check (a browser on another site can't post here)
 *   2. a flood limit on every request per IP, valid or not
 *   3. body size cap, then shape/length validation (plain text, links counted, junk refused)
 *   4. the honeypot: a filled hidden field is a script, and gets a convincing "success" that stores nothing
 *   5. the signed form token (this post's form, open for a few seconds, not stale)
 *   6. the post must be published
 *   7. per-IP limits on valid-looking submissions (burst + daily)
 *   8. queue limits and duplicate detection in the data layer
 * The comment is stored as `pending`: nothing a visitor sends is public until an admin approves it.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
    try {
        if (!isSameOrigin(req)) return forbiddenOrigin();

        const { blogId } = await params;
        const ip = getClientIp(req);

        const flood = await consume(rateLimitKey("blog-comment-attempt", ip), COMMENT_ANTISPAM.attempts);
        if (!flood.allowed) return tooManyRequests(flood.retryAfterSeconds, "Too many requests. Please try again in a little while.", "RATE_LIMITED");

        // Shape first, then the honeypot on the raw value (it runs even when validation would fail).
        const parsed = await parsePublicBody(req, CreateCommentSchema);
        if (parsed.raw && typeof parsed.raw === "object") {
            const trap = (parsed.raw as Record<string, unknown>)[COMMENT_HONEYPOT_FIELD];
            if (typeof trap === "string" && trap.trim() !== "") {
                return NextResponse.json({ success: true, status: "pending", message: PENDING_MESSAGE }, { status: 201 });
            }
        }
        if (parsed.response) return parsed.response;

        switch (checkCommentFormToken(blogId, parsed.data.token)) {
            case "ok":
                break;
            case "too_fast":
                return errorResponse("TOO_FAST", "That was quick! Please take a moment to read your comment over, then send it again.", 429);
            case "expired":
                return errorResponse("FORM_EXPIRED", "This form has expired. Please reload the page and send your comment again.", 400);
            default:
                return errorResponse("FORM_INVALID", "Something went wrong with the form. Please reload the page and try again.", 400);
        }

        const blog = await getPublishedBlog(blogId);
        if (!blog) throw new BlogApiError("NOT_FOUND", "That post isn't available for comments.", 404);

        for (const [index, policy] of COMMENT_ANTISPAM.perIp.entries()) {
            const { allowed, retryAfterSeconds } = await consume(rateLimitKey(`blog-comment-ip-${index}`, ip), policy);
            if (!allowed) {
                return tooManyRequests(retryAfterSeconds, "You're sending comments too quickly. Please wait a while and try again.", "RATE_LIMITED");
            }
        }

        await createVisitorComment(blogId, parsed.data, hashIdentifier(ip));
        return NextResponse.json({ success: true, status: "pending", message: PENDING_MESSAGE }, { status: 201 });
    } catch (error) {
        return handleRouteError(error, "Error saving a blog comment", "Something went wrong while sending your comment. Please try again.");
    }
}
