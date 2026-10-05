/**
 * SERVER ONLY. Push notifications for calls, on top of the project's own notification system
 * (components/notification): a callee who isn't on the chat page still learns they are being called,
 * and a notification that outlives its ring is replaced by "Missed call".
 *
 * These are ephemeral alerts, so they are sent to the callee's devices directly instead of by user id:
 * addressing by user id would also add an entry to the in-app notification list (and its unread badge)
 * for every ring. Same `tag` for the ring and the missed-call notice, so the second replaces the first.
 *
 * Nothing in here throws: a push that can't be sent must never fail the call itself.
 */
import { usersViewing } from "@/components/notification/lib/activeContext.server";
import { sendNotification } from "@/components/notification/lib/sendNotification";
import { getTokensForUsers } from "@/components/notification/lib/tokens.server";
import { CALL_RING_TIMEOUT_MS, type CallMode } from "./call";
import type { CallRecord } from "./callMachine";

const kindOf = (mode: CallMode) => (mode === "video" ? "video" : "voice");

async function pushToCallee(call: CallRecord, body: string, ttlSeconds?: number): Promise<void> {
    try {
        // Somebody already looking at this conversation sees the call ring in the page itself.
        const link = `/chat?receiverId=${encodeURIComponent(call.callerId)}`;
        const viewing = await usersViewing([call.calleeId], link).catch(() => new Set<string>());
        if (viewing.has(call.calleeId)) return;

        const tokens = await getTokensForUsers([call.calleeId]);
        if (tokens.length === 0) return;

        const result = await sendNotification({
            tokens,
            type: "chat_message",
            title: call.callerName.slice(0, 100) || "Easy Arabic",
            body,
            link,
            tag: `call:${call.id}`,
            urgency: "high",
            ...(ttlSeconds !== undefined && { ttlSeconds }),
        });
        if (!result.success) console.error("[chat/calls] Call notification failed:", result.error?.message);
    } catch (error) {
        console.error("[chat/calls] Call notification failed:", error);
    }
}

/** "Incoming video call". It is worthless once the ring is over, so it expires with it. */
export function notifyIncomingCall(call: CallRecord): Promise<void> {
    return pushToCallee(call, `Incoming ${kindOf(call.mode)} call`, Math.ceil(CALL_RING_TIMEOUT_MS / 1000));
}

/** "Missed voice call": replaces the ring notification. */
export function notifyMissedCall(call: CallRecord): Promise<void> {
    return pushToCallee(call, `Missed ${kindOf(call.mode)} call`);
}
