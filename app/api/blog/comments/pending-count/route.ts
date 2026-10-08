import { NextRequest, NextResponse } from "next/server";
import { countPendingComments } from "@/components/blog/lib/comments.server";
import { handleRouteError, requireAdmin } from "@/components/blog/lib/http.server";

export const runtime = "nodejs";

/** GET /api/blog/comments/pending-count: how many comments await review (the sidebar badge). Admin only. */
export async function GET(req: NextRequest) {
    try {
        const auth = await requireAdmin(req);
        if (auth.response) return auth.response;

        const count = await countPendingComments();
        return NextResponse.json({ success: true, count }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        return handleRouteError(error, "Error counting pending comments", "An internal server error occurred.");
    }
}
