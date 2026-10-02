import { deleteUserToken, registerUserToken } from "@/components/notification/lib/tokens.server";
import { firstValidationMessage, fcmTokenSchema } from "@/lib/validation";
import { authorization } from "@/lib/verifyAuth";
import { NextRequest, NextResponse } from "next/server";

const forbidden = () =>
    NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Forbidden" } },
        { status: 403 }
    );

const validationError = (message: string) =>
    NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message } },
        { status: 400 }
    );

const serverError = (error: unknown) => {
    console.error(error);
    return NextResponse.json(
        { success: false, error: { code: "SERVER_ERROR", message: "Error in server" } },
        { status: 500 }
    );
};

/** Registers the calling browser's FCM token for the signed-in user (idempotent). */
export async function POST(req: NextRequest) {
    try {
        const { user } = await authorization();
        if (!user) return forbidden();

        const validation = fcmTokenSchema.safeParse(await req.json());
        if (!validation.success) return validationError(firstValidationMessage(validation.error));

        const { fcmToken, deviceType } = validation.data;
        const outcome = await registerUserToken({ userId: user.id, fcmToken, deviceType });

        return NextResponse.json(
            { message: outcome === "exists" ? "Token already exists" : "Token created successfully" },
            { status: 200 }
        );
    } catch (error) {
        return serverError(error);
    }
}

/**
 * Removes the calling browser's FCM token for the signed-in user. Call it BEFORE signing out
 * (see `unregisterDevice` in NotificationProvider) — after sign-out there is no session left
 * to authorise the request.
 */
export async function DELETE(req: NextRequest) {
    try {
        const { user } = await authorization();
        if (!user) return forbidden();

        const validation = fcmTokenSchema.pick({ fcmToken: true }).safeParse(await req.json());
        if (!validation.success) return validationError(firstValidationMessage(validation.error));

        await deleteUserToken(user.id, validation.data.fcmToken);
        return NextResponse.json({ message: "Token removed successfully" }, { status: 200 });
    } catch (error) {
        return serverError(error);
    }
}
