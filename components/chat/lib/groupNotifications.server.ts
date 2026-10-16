/**
 * SERVER ONLY. The notifications of group chats, on top of the project's own notification system
 * (components/notification), the way ./messageNotifications.server.ts does it for a direct chat: addressed by user
 * id, so every member gets a push on their devices and a stored copy for the in-app list.
 *
 *   - somebody who is looking at the group is skipped by sendNotification itself (same `link`);
 *   - the `tag` is the group, so its next message replaces this notification instead of stacking another one;
 *   - the text says who and where, never what: lock screens show it to bystanders.
 *
 * Nothing in here throws: a notification that can't be sent must never fail the request that triggered it.
 */
import { usersViewing } from "@/components/notification/lib/activeContext.server";
import { sendNotification } from "@/components/notification/lib/sendNotification";
import { db } from "@/prisma/db";

const linkTo = (path: string, groupId: string) => `${path}?groupId=${encodeURIComponent(groupId)}`;

/** The members that aren't looking at the group's page right now (admins can have it open under /dashboard/chat). */
async function notYetViewing(recipientIds: readonly string[], groupId: string): Promise<string[]> {
    if (recipientIds.length === 0) return [];

    const admins = (await db.orm.public.User
        .where((user) => user.id.in([...recipientIds]))
        .select("id", "role")
        .all()) as unknown as { id: string; role: string }[];
    const adminIds = admins.filter((user) => user.role === "admin").map((user) => user.id);
    if (adminIds.length === 0) return [...recipientIds];

    const viewing = await usersViewing(adminIds, linkTo("/dashboard/chat", groupId)).catch(() => new Set<string>());
    return recipientIds.filter((id) => !viewing.has(id));
}

async function notifyMembers(
    recipientIds: readonly string[],
    groupId: string,
    content: { title: string; body: string; data?: Record<string, string> }
): Promise<void> {
    try {
        const audience = await notYetViewing(recipientIds, groupId);
        if (audience.length === 0) return;

        const result = await sendNotification({
            userIds: audience,
            type: "chat_message",
            title: content.title.slice(0, 100) || "Easy Arabic",
            body: content.body.slice(0, 200),
            ...(content.data ? { data: content.data } : {}),
            link: linkTo("/chat", groupId),
            tag: `group:${groupId}`,
        });
        if (!result.success) console.error("[chat/groups] Group notification failed:", result.error?.message);
    } catch (error) {
        console.error("[chat/groups] Group notification failed:", error);
    }
}

/** Tells the members of a new group (everybody but its creator) that `creatorName` added them to it. */
export function notifyGroupCreated({
    groupId,
    groupName,
    creatorName,
    memberIds,
}: {
    groupId: string;
    groupName: string;
    creatorName: string;
    memberIds: readonly string[];
}): Promise<void> {
    return notifyMembers(memberIds, groupId, {
        title: groupName,
        body: `${creatorName || "Someone"} added you to this group`,
    });
}

/** Tells the members of a group (everybody but the sender, who is not in `recipientIds`) about a new message. */
export function notifyGroupMessage({
    groupId,
    groupName,
    senderName,
    recipientIds,
    message,
}: {
    groupId: string;
    groupName: string;
    senderName: string;
    recipientIds: readonly string[];
    message: string;
}): Promise<void> {
    return notifyMembers(recipientIds, groupId, {
        title: groupName,
        body: `${senderName || "Someone"} sent a message`,
        data: { message },
    });
}
