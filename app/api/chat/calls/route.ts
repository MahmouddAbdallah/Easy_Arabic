import { after, NextRequest, NextResponse } from "next/server";
import type { CallResponse } from "@/components/chat/lib/call";
import {
    acceptCall,
    declineCall,
    endCall,
    getCall,
    getCurrentCall,
    heartbeat,
    isMissedCall,
    markRinging,
    reportConnected,
    sendSignals,
    startCall,
    type CallResult,
} from "@/components/chat/lib/callOperations.server";
import { notifyIncomingCall, notifyMissedCall } from "@/components/chat/lib/callNotifications.server";
import { CallQuerySchema, CallRequestSchema, type CallRequest } from "@/components/chat/lib/callSchemas";
import { errorResponse, handleRouteError, parseBody, rateLimitUser, requireUser } from "@/components/chat/lib/http.server";
import type { userType } from "@/types/userTypes";

// firebase-admin and the database need the Node.js runtime.
export const runtime = "nodejs";

/** Placing calls is what can be abused (it rings someone's device), so it is limited tightly. */
const START_LIMIT = { limit: 10, windowSeconds: 60 };
/** Everything else is signaling and heartbeats: generous, but not unbounded. */
const ACTION_LIMIT = { limit: 600, windowSeconds: 60 };

/** The call as the requester sees it. Never cached: it is a live state. */
function reply(result: CallResult | null) {
    const body: CallResponse = { success: true, call: result?.view ?? null, serverNow: Date.now() };
    return NextResponse.json(body, { status: 200, headers: { "Cache-Control": "no-store" } });
}

/** A call that finished without the callee picking up leaves a "Missed call" notice, after the response. */
function replyAndNotify(result: CallResult) {
    if (result.finished && isMissedCall(result.record)) after(() => notifyMissedCall(result.record));
    return reply(result);
}

async function run(request: Exclude<CallRequest, { action: "start" }>, user: userType): Promise<CallResult> {
    const actor = { callId: request.callId, actorId: user.id, after: "after" in request ? request.after : undefined };

    switch (request.action) {
        case "ringing":
            return markRinging(actor);
        case "accept":
            return acceptCall({ ...actor, answer: request.answer });
        case "decline":
            return declineCall(actor);
        case "end":
            return endCall({ ...actor, reason: request.reason });
        case "connected":
            return reportConnected(actor);
        case "heartbeat":
            return heartbeat(actor);
        case "signal":
            return sendSignals({ ...actor, signals: request.signals });
    }
}

/**
 * Call mutations. Body is a discriminated union on `action`:
 *   start | ringing | accept | decline | end | connected | heartbeat | signal
 * The acting user is always taken from the authenticated session, never from the body. Every response
 * carries the call as the requester sees it, including any signaling messages newer than `after`.
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireUser();
        if (auth.response) return auth.response;
        const { user } = auth;

        const parsed = await parseBody(req, CallRequestSchema);
        if (parsed.response) return parsed.response;
        const request = parsed.data;

        const limited =
            request.action === "start"
                ? await rateLimitUser("chat-call-start", user.id, START_LIMIT, "You're calling too fast. Please wait a moment and try again.")
                : await rateLimitUser("chat-call", user.id, ACTION_LIMIT, "Too many requests. Please slow down.");
        if (limited) return limited;

        if (request.action !== "start") return replyAndNotify(await run(request, user));

        const started = await startCall({
            caller: user,
            receiverId: request.receiverId,
            mode: request.mode,
            offer: request.offer,
        });
        // Push after the response: the caller doesn't wait for FCM.
        after(() => (started.ringing ? notifyIncomingCall(started.record) : notifyMissedCall(started.record)));
        return reply(started);
    } catch (error) {
        return handleRouteError(error, "Error handling chat call request", "An internal server error occurred while processing the call.");
    }
}

/**
 * Read a call: `?callId=…&after=<last signal number you have>`, or without `callId` the call the user
 * is in right now (`call: null` when there is none). Reading also settles an expired ring.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await requireUser();
        if (auth.response) return auth.response;
        const { user } = auth;

        const limited = await rateLimitUser("chat-call", user.id, ACTION_LIMIT, "Too many requests. Please slow down.");
        if (limited) return limited;

        const params = req.nextUrl.searchParams;
        const query = CallQuerySchema.safeParse({
            callId: params.get("callId") ?? undefined,
            after: params.get("after") ?? undefined,
        });
        if (!query.success) return errorResponse("VALIDATION_ERROR", "Invalid query provided", 400);

        const { callId, after: cursor = 0 } = query.data;
        if (!callId) return reply(await getCurrentCall(user.id, cursor));
        return replyAndNotify(await getCall({ callId, viewerId: user.id, after: cursor }));
    } catch (error) {
        return handleRouteError(error, "Error reading chat call", "An internal server error occurred while reading the call.");
    }
}
