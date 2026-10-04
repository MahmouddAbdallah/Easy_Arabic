import { handledSchema } from "@/components/notification/lib/schema";
import { resolveNotification } from "@/components/notification/lib/server/inbox";
import { NextResponse } from "next/server";
import { authedJsonRoute } from "../_lib/route";

/**
 * The signed-in user clicked a delivered notification (`{ key }` — NotificationPayload.key), so its
 * stored copy in the `Notification` collection is deleted and, if it was still unread, leaves the unread
 * count. Called by the in-app toast and by the service worker's notification click. Idempotent: a
 * notification that was never stored (`persist: false`), is already gone or belongs to someone else
 * simply resolves to `resolved: false` — the document id is derived from the session's user and the key,
 * so nobody can clear another user's notifications.
 *
 * POST rather than DELETE so the browser can also send it with `fetch(..., { keepalive: true })`
 * while the click navigates away.
 */
export const POST = authedJsonRoute(handledSchema, async (user, { key }) => {
    const resolved = await resolveNotification(user.id, key);

    return NextResponse.json({ success: true, resolved }, { status: 200 });
});
