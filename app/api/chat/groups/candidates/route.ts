import { NextRequest, NextResponse } from "next/server";
import { listGroupCandidates } from "@/components/chat/lib/groupOperations.server";
import { groupErrorResponse } from "@/components/chat/lib/groupHttp.server";
import { GroupCandidatesQuerySchema, type GroupCandidatesResponse } from "@/components/chat/lib/groupSchemas";
import { canCreateGroup } from "@/components/chat/lib/groups";
import { errorResponse, rateLimitUser, requireUser } from "@/components/chat/lib/http.server";

export const runtime = "nodejs";

/** One call per keystroke pause while the picker is open, so this is generous; it only stops a scraper. */
const SEARCH_LIMIT = { limit: 120, windowSeconds: 60 };

/**
 * GET ?keyword=…: the people the signed-in user can add to a group. An admin can add anybody with an active
 * account, a teacher the families assigned to them. Only id, name, role and photo are returned, never contact details.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await requireUser();
        if (auth.response) return auth.response;
        const { user } = auth;

        if (!canCreateGroup(user.role)) {
            return errorResponse("FORBIDDEN", "Only teachers and admins can create groups.", 403);
        }

        const limited = await rateLimitUser(
            "chat-group-candidates",
            user.id,
            SEARCH_LIMIT,
            "You're searching too quickly. Please wait a moment and try again."
        );
        if (limited) return limited;

        const query = GroupCandidatesQuerySchema.safeParse({ keyword: req.nextUrl.searchParams.get("keyword") ?? undefined });
        if (!query.success) {
            return errorResponse("VALIDATION_ERROR", query.error.issues[0]?.message ?? "Invalid search.", 400);
        }

        const { people, hasMore } = await listGroupCandidates(user, query.data.keyword ?? "");
        const body: GroupCandidatesResponse = { success: true, people, hasMore };
        return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        return groupErrorResponse(error, "Error listing people to add to a group", "An internal server error occurred while loading people.");
    }
}
