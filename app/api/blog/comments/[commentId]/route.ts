import { NextRequest, NextResponse } from "next/server";
import { UpdateCommentSchema } from "@/components/blog/lib/comment-schemas";
import { deleteComment, setCommentStatus } from "@/components/blog/lib/comments.server";
import { handleRouteError, parseBody, requireAdmin } from "@/components/blog/lib/http.server";

export const runtime = "nodejs";

interface RouteParams {
    params: Promise<{ commentId: string }>;
}

/** PATCH /api/blog/comments/:id { status }: approve (publish) a comment, or send it back to pending (unpublish). */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    try {
        const auth = await requireAdmin(req);
        if (auth.response) return auth.response;

        const parsed = await parseBody(req, UpdateCommentSchema);
        if (parsed.response) return parsed.response;

        const { commentId } = await params;
        const result = await setCommentStatus(commentId, parsed.data.status, { id: auth.user.id, name: auth.user.name });
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        return handleRouteError(error, "Error moderating a blog comment", "An internal server error occurred while updating the comment.");
    }
}

/** DELETE /api/blog/comments/:id: rejects a pending comment or removes a published one, together with its replies. */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    try {
        const auth = await requireAdmin(req);
        if (auth.response) return auth.response;

        const { commentId } = await params;
        const result = await deleteComment(commentId);
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        return handleRouteError(error, "Error deleting a blog comment", "An internal server error occurred while deleting the comment.");
    }
}
