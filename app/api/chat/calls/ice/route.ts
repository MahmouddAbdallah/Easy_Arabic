import { NextResponse } from "next/server";
import type { CallIceResponse } from "@/components/chat/lib/call";
import { getIceServers } from "@/components/chat/lib/callIce.server";
import { handleRouteError, rateLimitUser, requireUser } from "@/components/chat/lib/http.server";

// Short-lived TURN credentials are signed with Node's crypto.
export const runtime = "nodejs";

const ICE_LIMIT = { limit: 60, windowSeconds: 60 };

/** The STUN/TURN servers a browser needs for a call. Per user, never cached: TURN credentials expire. */
export async function GET() {
    try {
        const auth = await requireUser();
        if (auth.response) return auth.response;

        const limited = await rateLimitUser("chat-call-ice", auth.user.id, ICE_LIMIT, "Too many requests. Please slow down.");
        if (limited) return limited;

        const body: CallIceResponse = { success: true, iceServers: getIceServers(auth.user.id) };
        return NextResponse.json(body, { status: 200, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        return handleRouteError(error, "Error loading call servers", "An internal server error occurred while preparing the call.");
    }
}
