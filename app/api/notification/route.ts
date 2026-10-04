import { sendNotification } from "@/components/notification/lib/sendNotification";
import { NextResponse } from "next/server";
import { authedRoute } from "./_lib/route";

/**
 * Smoke test for the notification pipeline: sends a sample notification to the signed-in user
 * only. It shows up in their in-app list (open /notification and watch it arrive) and, if they
 * enabled push on this device, as a push notification too. It can only ever notify the caller,
 * so it is safe to leave deployed.
 */
export const GET = authedRoute(async (user) => {
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
});
