import { deleteUserToken, registerUserToken } from "@/components/notification/lib/server/devices";
import { fcmTokenSchema } from "@/lib/validation";
import { NextResponse } from "next/server";
import { authedJsonRoute } from "../_lib/route";

/** Registers the calling browser's FCM token for the signed-in user (idempotent). */
export const POST = authedJsonRoute(fcmTokenSchema, async (user, { fcmToken, deviceType }) => {
    const outcome = await registerUserToken({ userId: user.id, fcmToken, deviceType });

    return NextResponse.json(
        { message: outcome === "exists" ? "Token already exists" : "Token created successfully" },
        { status: 200 }
    );
});

/**
 * Removes the calling browser's FCM token for the signed-in user. Call it BEFORE signing out
 * (see `unregisterDevice` in NotificationProvider) — after sign-out there is no session left
 * to authorise the request.
 */
export const DELETE = authedJsonRoute(fcmTokenSchema.pick({ fcmToken: true }), async (user, { fcmToken }) => {
    await deleteUserToken(user.id, fcmToken);

    return NextResponse.json({ message: "Token removed successfully" }, { status: 200 });
});
