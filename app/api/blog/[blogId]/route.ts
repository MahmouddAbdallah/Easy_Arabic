import { after, NextRequest, NextResponse } from "next/server";
import { deleteBlog, getBlogForAdmin, updateBlog } from "@/components/blog/lib/blogs.server";
import { deleteCommentsForBlog } from "@/components/blog/lib/comments.server";
import { BlogApiError, handleRouteError, parseBody, requireAdmin } from "@/components/blog/lib/http.server";
import { deleteBlogMedia } from "@/components/blog/lib/media.server";
import { revalidateBlogPaths } from "@/components/blog/lib/revalidate.server";
import { UpdateBlogSchema } from "@/components/blog/lib/schemas";

export const runtime = "nodejs";

interface RouteParams {
    params: Promise<{ blogId: string }>;
}

/** GET /api/blog/:id: the whole post (any status) for the editor. */
export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        const auth = await requireAdmin(req);
        if (auth.response) return auth.response;

        const { blogId } = await params;
        const blog = await getBlogForAdmin(blogId);
        if (!blog) throw new BlogApiError("NOT_FOUND", "That post doesn't exist.", 404);

        return NextResponse.json({ success: true, blog });
    } catch (error) {
        return handleRouteError(error, "Error loading a blog post", "An internal server error occurred while loading the post.");
    }
}

/**
 * PATCH /api/blog/:id: partial update. Used for saving the editor (every field), for publishing and
 * unpublishing (`{ status }`), and for quick actions from the list. Publishing is validated here.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    try {
        const auth = await requireAdmin(req);
        if (auth.response) return auth.response;

        const parsed = await parseBody(req, UpdateBlogSchema);
        if (parsed.response) return parsed.response;

        const { blogId } = await params;
        const { blog, previousSlug } = await updateBlog(blogId, parsed.data);

        // Refresh the public pages: the post's page (old and new address) and the list.
        revalidateBlogPaths(previousSlug, blog.slug);

        return NextResponse.json({ success: true, blog });
    } catch (error) {
        return handleRouteError(error, "Error updating a blog post", "An internal server error occurred while saving the post.");
    }
}

/** DELETE /api/blog/:id: removes the post, then (after the response) every file in its Cloudinary folder and every comment on it. */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    try {
        const auth = await requireAdmin(req);
        if (auth.response) return auth.response;

        const { blogId } = await params;
        const { blog } = await deleteBlog(blogId);

        revalidateBlogPaths(blog.slug);
        // The admin doesn't wait for Cloudinary.
        after(() => deleteBlogMedia(blogId));
        after(() => deleteCommentsForBlog(blogId));

        return NextResponse.json({ success: true });
    } catch (error) {
        return handleRouteError(error, "Error deleting a blog post", "An internal server error occurred while deleting the post.");
    }
}
