import { adminMessaging } from "@/lib/config/firebase-admin";

export async function sendNotification(fcmToken: string, title: string, body: string, extraData = {}) {
    const message = {
        notification: {
            title: title,
            body: body,
        },
        data: extraData,
        token: fcmToken,
    };

    try {
        const response = await adminMessaging.send(message);
        return response;
    } catch (error) {
        console.error("Error sending message:", error);
    }
}