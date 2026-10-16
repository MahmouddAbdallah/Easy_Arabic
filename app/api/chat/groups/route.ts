import { after, NextRequest, NextResponse } from "next/server";
import { createGroup } from "@/components/chat/lib/groupOperations.server";
import { groupErrorResponse, parseGroupBody } from "@/components/chat/lib/groupHttp.server";
import { notifyGroupCreated } from "@/components/chat/lib/groupNotifications.server";
import { CreateGroupRequestSchema, type CreateGroupResponse } from "@/components/chat/lib/groupSchemas";
import { canCreateGroup } from "@/components/chat/lib/groups";
import { errorResponse, rateLimitUser, requireUser } from "@/components/chat/lib/http.server";

// Talks to Firestore, the database and Cloudinary's Admin API.
export const runtime = "nodejs";

/** A person starts a handful of groups in a day, not ten in ten minutes; this only stops a script. */
const CREATE_LIMIT = { limit: 10, windowSeconds: 600 };

/**
 * POST: create a group chat. The creator is always the signed-in user and only teachers and admins may create one.
 * Who can be added is decided here (see createGroup), not by what the browser listed. The request carries the id of
 * the group, so repeating it is safe: the second one is answered with the group the first one made (`created: false`).
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireUser();
        if (auth.response) return auth.response;
        const { user } = auth;

        if (!canCreateGroup(user.role)) {
            return errorResponse("FORBIDDEN", "Only teachers and admins can create groups.", 403);
        }

        const limited = await rateLimitUser(
            "chat-group-create",
            user.id,
            CREATE_LIMIT,
            "You're creating groups too quickly. Please wait a few minutes and try again."
        );
        if (limited) return limited;

        const parsed = await parseGroupBody(req, CreateGroupRequestSchema);
        if (parsed.response) return parsed.response;

        const result = await createGroup({ actor: user, request: parsed.data });

        // Only for a group this request really created, and after the response: nobody waits for a push.
        if (result.announce) {
            const { groupName, memberIds } = result.announce;
            after(() => notifyGroupCreated({ groupId: result.group.id, groupName, creatorName: user.name, memberIds }));
        }

        const body: CreateGroupResponse = { success: true, created: result.created, group: result.group };
        return NextResponse.json(body, { status: result.created ? 201 : 200, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        return groupErrorResponse(error, "Error creating a chat group", "An internal server error occurred while creating the group.");
    }
}
