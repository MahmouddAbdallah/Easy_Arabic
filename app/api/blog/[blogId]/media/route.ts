import { NextRequest, NextResponse } from "next/server";
import { consume, rateLimitKey } from "@/lib/auth/rateLimit";
import { blogExists } from "@/components/blog/lib/blogs.server";
import { MEDIA_RATE_LIMIT, type BlogMediaKind } from "@/components/blog/lib/constants";
import { BlogApiError, errorResponse, handleRouteError, requireAdmin } from "@/components/blog/lib/http.server";
import { uploadBlogMedia } from "@/components/blog/lib/media.server";

export const runtime = "nodejs";
// Video uploads can take a while on hosts that honour this.
export const maxDuration = 60;

interface RouteParams {
    params: Promise<{ blogId: string }>;
}

/**
 * POST /api/blog/:id/media (multipart: `file`, `kind` = "image" | "video").
 * Stores the file in the post's own Cloudinary folder via the project's `handleUploadCloudinary` and
 * returns its permanent URL. The editor inserts that URL into the post; nothing else is stored here.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
    try {
        const auth = await requireAdmin(req);
        if (auth.response) return auth.response;

        const { allowed, retryAfterSeconds } = await consume(rateLimitKey("blog-upload", auth.user.id), MEDIA_RATE_LIMIT);
        if (!allowed) {
            return errorResponse(
                "RATE_LIMITED",
                "You're uploading too fast. Please wait a moment and try again.",
                429,
                undefined,
                { "Retry-After": String(Math.max(retryAfterSeconds, 1)) }
            );
        }

        const { blogId } = await params;
        if (!(await blogExists(blogId))) throw new BlogApiError("NOT_FOUND", "That post doesn't exist.", 404);

        let form: FormData;
        try {
            form = await req.formData();
        } catch {
            throw new BlogApiError("INVALID_FORM", "The upload could not be read.", 400);
        }

        const kind: BlogMediaKind = form.get("kind") === "video" ? "video" : "image";

        // `uploadBlogMedia` validates the entry (it may be missing, or a string) before touching it.
        const media = await uploadBlogMedia(form.get("file"), blogId, kind);
        return NextResponse.json({ success: true, media }, { status: 201 });
    } catch (error) {
        return handleRouteError(error, "Error uploading blog media", "An internal server error occurred while uploading the file.");
    }
}
