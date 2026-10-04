import { resolveNotification } from "@/components/notification/lib/inbox.server";
import { handledSchema } from "@/components/notification/lib/schema";
import { firstValidationMessage } from "@/lib/validation";
import { authorization } from "@/lib/verifyAuth";
import { NextRequest, NextResponse } from "next/server";
import { forbidden, serverError, validationError } from "../_lib/responses";

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
export async function POST(req: NextRequest) {
    try {
        const { user } = await authorization();
        if (!user) return forbidden();

        const validation = handledSchema.safeParse(await req.json().catch(() => null));
        if (!validation.success) return validationError(firstValidationMessage(validation.error));

        const resolved = await resolveNotification(user.id, validation.data.key);

        return NextResponse.json({ success: true, resolved }, { status: 200 });
    } catch (error) {
        return serverError(error);
    }
}
