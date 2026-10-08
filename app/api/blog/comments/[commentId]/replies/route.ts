import { NextRequest, NextResponse } from "next/server";
import { CreateReplySchema } from "@/components/blog/lib/comment-schemas";
import { createAdminReply } from "@/components/blog/lib/comments.server";
import { handleRouteError, parseBody, requireAdmin } from "@/components/blog/lib/http.server";

export const runtime = "nodejs";

interface RouteParams {
    params: Promise<{ commentId: string }>;
}

/** POST /api/blog/comments/:id/replies { body }: an admin reply under an approved comment. Public as soon as it is posted. */
export async function POST(req: NextRequest, { params }: RouteParams) {
    try {
        const auth = await requireAdmin(req);
        if (auth.response) return auth.response;

        const parsed = await parseBody(req, CreateReplySchema);
        if (parsed.response) return parsed.response;

        const { commentId } = await params;
        const reply = await createAdminReply(commentId, parsed.data, { id: auth.user.id, name: auth.user.name });
        return NextResponse.json({ success: true, reply }, { status: 201 });
    } catch (error) {
        return handleRouteError(error, "Error replying to a blog comment", "An internal server error occurred while posting the reply.");
    }
}
