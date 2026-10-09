import { NextRequest, NextResponse } from "next/server";
import {
    ConversationRequestSchema,
    type ConversationRequest,
    type ConversationResponse,
} from "@/components/chat/lib/conversationSchemas";
import {
    blockUser,
    clearChat,
    deleteChat,
    unblockUser,
} from "@/components/chat/lib/conversationOperations.server";
import { handleRouteError, parseBody, rateLimitUser, requireUser } from "@/components/chat/lib/http.server";

// firebase-admin and the database need the Node.js runtime.
export const runtime = "nodejs";

/** Nobody blocks, clears or deletes dozens of chats a minute; a script that tries is held back. */
const CONVERSATION_LIMIT = { limit: 30, windowSeconds: 60 };

async function run(request: ConversationRequest, actorId: string): Promise<ConversationResponse> {
    const { receiverId } = request;

    switch (request.action) {
        case "block":
            await blockUser({ actorId, receiverId });
            return { success: true, action: "block", blocked: true };
        case "unblock":
            await unblockUser({ actorId, receiverId });
            return { success: true, action: "unblock", blocked: false };
        case "clear": {
            const { clearedAt } = await clearChat({ actorId, receiverId, upTo: request.upTo });
            return { success: true, action: "clear", clearedAt };
        }
        case "delete": {
            const { clearedAt, deletedAt } = await deleteChat({ actorId, receiverId, upTo: request.upTo });
            return { success: true, action: "delete", clearedAt, deletedAt };
        }
    }
}

/**
 * Per-person actions on a conversation. Body is a discriminated union on `action`:
 *   block | unblock | clear | delete
 *
 * The acting user is always the authenticated session user and the chat is always "their chat with
 * `receiverId`": the body never names a chat or a user to act as. Every action changes only the actor's
 * own side of the conversation (see lib/conversationOperations.server.ts), so none of them can reach the
 * other person's history, list or unread counter. All four are idempotent.
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireUser();
        if (auth.response) return auth.response;
        const { user } = auth;

        const limited = await rateLimitUser(
            "chat-conversation",
            user.id,
            CONVERSATION_LIMIT,
            "You're doing that too fast. Please wait a moment and try again."
        );
        if (limited) return limited;

        const parsed = await parseBody(req, ConversationRequestSchema);
        if (parsed.response) return parsed.response;

        const body = await run(parsed.data, user.id);
        // Per-user and always fresh.
        return NextResponse.json(body, { status: 200, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        return handleRouteError(
            error,
            "Error handling chat conversation request",
            "An internal server error occurred while updating the conversation."
        );
    }
}
