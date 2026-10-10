/**
 * SERVER ONLY. The notification for a new chat message, on top of the project's own notification
 * system (components/notification): somebody who isn't looking at the conversation still learns that
 * a message arrived.
 *
 * It is addressed by user id, the way sendNotification's documentation shows for chat: the recipient
 * gets a push on their devices and a stored copy for the in-app list, so a push that can't be shown
 * (no device, notifications paused, quiet hours) never means a missed message. The `tag` is the sender:
 * their next message replaces this notification, on screen and in the list, instead of stacking another
 * one, and sendNotification drops an identical send within a few seconds, so a quick burst of messages
 * is one notification.
 *
 * The text is deliberately generic, because lock screens show it to bystanders: who wrote, never what.
 *
 * Nothing in here throws: a notification that can't be sent must never fail the message itself.
 */
import { usersViewing } from "@/components/notification/lib/activeContext.server";
import { sendNotification } from "@/components/notification/lib/sendNotification";
import { db } from "@/prisma/db";

/** Tells `receiverId` that `senderId` (named `senderName`) just sent them a message. Nobody else hears about it. */
export async function notifyNewMessage(senderId: string, senderName: string, receiverId: string): Promise<void> {
    // Nobody is notified about a message they wrote to themselves.
    if (senderId === receiverId) return;

    try {
        // The send route accepts any receiverId; a notification (and its stored copy) is only for a real user.
        const receiver = await db.orm.public.User.where({ id: receiverId }).select("id", "role").first();
        if (!receiver) return;

        const from = encodeURIComponent(senderId);

        // Admins can have this very conversation open under /dashboard/chat, but sendNotification only skips
        // people who are looking at the notification's own link (/chat?...), so that tab is checked here.
        if (receiver.role === "admin") {
            const viewing = await usersViewing([receiverId], `/dashboard/chat?receiverId=${from}`).catch(
                () => new Set<string>()
            );
            if (viewing.has(receiverId)) return;
        }

        const result = await sendNotification({
            userId: receiverId,
            type: "chat_message",
            title: senderName.slice(0, 100) || "Easy Arabic",
            body: "Sent you a message",
            link: `/chat?receiverId=${from}`,
            tag: `chat:${senderId}`,
        });
        if (!result.success) console.error("[chat/messages] Message notification failed:", result.error?.message);
    } catch (error) {
        console.error("[chat/messages] Message notification failed:", error);
    }
}
