import { NextRequest, NextResponse } from "next/server";
import { parseCommentListQuery } from "@/components/blog/lib/comment-schemas";
import { listCommentsForAdmin } from "@/components/blog/lib/comments.server";
import { handleRouteError, requireAdmin } from "@/components/blog/lib/http.server";

export const runtime = "nodejs";

/**
 * GET /api/blog/comments?page=&pageSize=&search=&status=pending|approved|all&blogId=
 * The moderation list: top-level comments (newest first, oldest first on the Pending tab), each with
 * the admin replies under it, plus the tab counts. Admin only: visitors read approved comments on the
 * server, never through here.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await requireAdmin(req);
        if (auth.response) return auth.response;

        const result = await listCommentsForAdmin(parseCommentListQuery(req.nextUrl.searchParams));
        return NextResponse.json({ success: true, ...result }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        return handleRouteError(error, "Error listing blog comments", "An internal server error occurred while loading the comments.");
    }
}
