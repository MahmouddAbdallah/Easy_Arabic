import { NextRequest, NextResponse } from "next/server";
import { ChatSearchQuerySchema } from "@/components/chat/lib/schemas";
import { getChatId } from "@/components/chat/lib/chatId";
import { searchChatMessages } from "@/components/chat/lib/chatSearch.server";
import { errorResponse, handleRouteError, rateLimitUser, requireUser } from "@/components/chat/lib/http.server";

// firebase-admin needs Node, not the edge runtime.
export const runtime = "nodejs";

/**
 * A search request is one request per pause in typing, plus the follow-ups that keep looking through
 * older messages when nothing turned up yet. Generous enough for that, tight enough that a script
 * can't use it to read a whole chat history over and over.
 */
const SEARCH_LIMIT = { limit: 60, windowSeconds: 60 };

/**
 * Search the history of the signed-in user's chat with `receiverId`, newest match first:
 *   GET /api/chat/messages/search?receiverId=…&q=…[&cursor=…]
 *
 * The chat is derived from the session user and `receiverId`, and the chat document must list the user
 * as a participant, so nobody can search a conversation they aren't in. Each response is one bounded
 * slice of the history: `nextCursor` says where to carry on, and is null once everything was searched.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await requireUser();
        if (auth.response) return auth.response;
        const { user } = auth;

        const limited = await rateLimitUser(
            "chat-search",
            user.id,
            SEARCH_LIMIT,
            "You're searching too fast. Please wait a moment and try again."
        );
        if (limited) return limited;

        const params = req.nextUrl.searchParams;
        const query = ChatSearchQuerySchema.safeParse({
            receiverId: params.get("receiverId") ?? undefined,
            q: params.get("q") ?? undefined,
            cursor: params.get("cursor") || undefined,
        });
        if (!query.success) return errorResponse("VALIDATION_ERROR", "Invalid search request.", 400);

        const { receiverId, q, cursor } = query.data;
        const body = await searchChatMessages({
            userId: user.id,
            chatId: getChatId(user.id, receiverId),
            query: q,
            cursor,
        });

        // Per-user and always fresh: an edited or deleted message must never come back from a cache.
        return NextResponse.json(body, { status: 200, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        return handleRouteError(
            error,
            "Error searching chat messages",
            "An internal server error occurred while searching the conversation."
        );
    }
}
