import { sendNotification } from "@/components/notification/lib/sendNotification";
import { authorization } from "@/lib/verifyAuth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const { error, user } = await authorization();
        if (error && !user) {
            return NextResponse.json(
                { success: false, error: { code: "FORBIDDEN", message: "Forbidden" } },
                { status: 403 }
            );
        }

        await sendNotification(
            "d34xlCV4pPHYEevnRDbnzB:APA91bFUjX_gcInL7c3oX8sMy-Z9xkfdVDsUEw9pv--bJR-FaWP8fjARp3vSgxJhSySTIntJ7xyQB6rbwFmCaVaO-aHOY7MxftKDeGcNW-N8xsthLP62rqs",
            "إشعار جديد 🚀",
            "عندك رسالة جديدة في التطبيق",
            { screen: "ChatScreen", chatId: "123" }
        );
        return NextResponse.json({ message: "Token created successfully" }, { status: 200 });

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
