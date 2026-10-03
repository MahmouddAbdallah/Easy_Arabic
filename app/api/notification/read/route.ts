import { markAllAsRead, markAsRead } from "@/components/notification/lib/inbox.server";
import { markReadSchema } from "@/components/notification/lib/schema";
import { firstValidationMessage } from "@/lib/validation";
import { authorization } from "@/lib/verifyAuth";
import { NextRequest, NextResponse } from "next/server";
import { forbidden, serverError, validationError } from "../_lib/responses";

/**
 * Marks the signed-in user's in-app notifications as read: `{ ids: [...] }` for specific ones,
 * `{ all: true }` for every unread one. Only the caller's own notifications are ever touched.
 * (The browser can read the `Notification` collection but never writes to it — all changes go
 * through here.)
 */
export async function PATCH(req: NextRequest) {
    try {
        const { user } = await authorization();
        if (!user) return forbidden();

        const validation = markReadSchema.safeParse(await req.json().catch(() => null));
        if (!validation.success) return validationError(firstValidationMessage(validation.error));

        const updated =
            "all" in validation.data
                ? await markAllAsRead(user.id)
                : await markAsRead(user.id, validation.data.ids);

        return NextResponse.json({ success: true, updated }, { status: 200 });
    } catch (error) {
        return serverError(error);
    }
}
