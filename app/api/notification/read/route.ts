import { markReadSchema } from "@/components/notification/lib/schema";
import { markAllAsRead, markAsRead } from "@/components/notification/lib/server/inbox";
import { NextResponse } from "next/server";
import { authedJsonRoute } from "../_lib/route";

/**
 * Marks the signed-in user's in-app notifications as read: `{ ids: [...] }` for specific ones,
 * `{ all: true }` for every unread one. Only the caller's own notifications are ever touched.
 * (The browser can read the `Notification` collection but never writes to it — all changes go
 * through here.)
 */
export const PATCH = authedJsonRoute(markReadSchema, async (user, body) => {
    const updated = "all" in body ? await markAllAsRead(user.id) : await markAsRead(user.id, body.ids);

    return NextResponse.json({ success: true, updated }, { status: 200 });
});
