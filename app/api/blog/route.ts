import { NextRequest, NextResponse } from "next/server";
import { createBlog, listBlogsForAdmin } from "@/components/blog/lib/blogs.server";
import { handleRouteError, parseBody, requireAdmin } from "@/components/blog/lib/http.server";
import { CreateBlogSchema, parseAdminListQuery } from "@/components/blog/lib/schemas";

// firebase-admin and the Cloudinary SDK need Node, not the edge runtime.
export const runtime = "nodejs";

/**
 * GET /api/blog?page=&pageSize=&search=&status=all|draft|published&category=
 * The dashboard's list: lean summaries (no post bodies), the status counts for the tabs, and the
 * categories/tags in use. Same `{ data, pagination }` contract as the app's other paginated endpoints.
 * Admin only: visitors read posts on the server (see components/blog/lib/blogs.server.ts), not here.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await requireAdmin(req);
        if (auth.response) return auth.response;

        const result = await listBlogsForAdmin(parseAdminListQuery(req.nextUrl.searchParams));
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        return handleRouteError(error, "Error listing blog posts", "An internal server error occurred while loading the posts.");
    }
}

/** POST /api/blog { title }: starts a draft and returns it, so the editor can open straight away. */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAdmin(req);
        if (auth.response) return auth.response;

        const parsed = await parseBody(req, CreateBlogSchema);
        if (parsed.response) return parsed.response;

        const blog = await createBlog(parsed.data, { id: auth.user.id, name: auth.user.name });
        return NextResponse.json({ success: true, blog }, { status: 201 });
    } catch (error) {
        return handleRouteError(error, "Error creating a blog post", "An internal server error occurred while creating the post.");
    }
}
