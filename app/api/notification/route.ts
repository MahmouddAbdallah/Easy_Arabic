import { sendNotification } from "@/components/notification/lib/sendNotification";
import { authorization } from "@/lib/verifyAuth";
import { NextResponse } from "next/server";

/**
 * Smoke test for the notification pipeline: sends a sample notification to the signed-in
 * user's OWN devices (open /notification, enable notifications, then hit this endpoint).
 * It can only ever notify the caller, so it is safe to leave deployed.
 */
export async function GET() {
    try {
        const { user } = await authorization();
        if (!user) {
            return NextResponse.json(
                { success: false, error: { code: "FORBIDDEN", message: "Forbidden" } },
                { status: 403 }
            );
        }

        const result = await sendNotification({
            userId: user.id,
            type: "general",
            title: "إشعار جديد 🚀",
            body: "عندك رسالة جديدة في التطبيق",
            link: "/chat",
            data: { chatId: "123" },
        });

        if (!result.success) {
            return NextResponse.json(result, {
                status: result.error?.code === "INVALID_INPUT" ? 400 : 500,
            });
        }
        return NextResponse.json(result, { status: 200 });

    } catch (error) {
        console.error(error);
        return NextResponse.json({
            success: false, error: {
                code: 'SERVER_ERROR',
                message: 'Error in server'
            }
        }, { status: 500 });
    }
}
