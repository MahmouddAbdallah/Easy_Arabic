/**
 * SERVER ONLY — talks to the database. Never import this from a client component.
 *
 * Everything that reads or writes the UserFCMToken table lives here so the rest of the
 * notification code (sendNotification, the fcm-token API route) never touches the ORM directly.
 */
import { db } from '@/prisma/db';
import { chunk } from './chunk';

/** Keeps `IN (...)` lists comfortably small. */
const IN_CLAUSE_CHUNK = 500;

/** Every registered device token for the given users (de-duplicated). */
export async function getTokensForUsers(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];

    const rows = await db.orm.public.UserFCMToken
        .where((t) => t.userId.in(userIds))
        .select('fcmToken')
        .all();

    return [...new Set(rows.map((row) => row.fcmToken))];
}

/**
 * Removes tokens FCM reported as dead (uninstalled / expired / revoked), whoever owned them.
 * Best-effort cleanup: callers should not let a failure here break a send.
 */
export async function deleteTokens(tokens: string[]): Promise<void> {
    for (const batch of chunk([...new Set(tokens)], IN_CLAUSE_CHUNK)) {
        await db.orm.public.UserFCMToken.where((t) => t.fcmToken.in(batch)).delete();
    }
}

/**
 * Saves a device token for a user. Idempotent.
 *
 * A token identifies one browser profile, so it may only belong to one user at a time. If the
 * same browser is later used to sign in as someone else, the token moves to the new user —
 * otherwise the previous user's notifications would keep popping up on that shared device.
 */
export async function registerUserToken(input: {
    userId: string;
    fcmToken: string;
    deviceType?: string;
}): Promise<'created' | 'exists'> {
    const { userId, fcmToken, deviceType } = input;

    const existing = await db.orm.public.UserFCMToken.where({ userId, fcmToken }).first();
    if (existing) return 'exists';

    try {
        await db.transaction(async (tx) => {
            await tx.orm.public.UserFCMToken
                .where((t) => t.fcmToken.eq(fcmToken))
                .where((t) => t.userId.neq(userId))
                .delete();
            await tx.orm.public.UserFCMToken.create({ userId, fcmToken, deviceType });
        });
        return 'created';
    } catch (error) {
        // Two identical registrations racing (two tabs, a double click) trip the unique
        // (userId, fcmToken) constraint. If the row exists now, the goal is met.
        const row = await db.orm.public.UserFCMToken.where({ userId, fcmToken }).first();
        if (row) return 'exists';
        throw error;
    }
}

/** Removes one device (used when a user signs out of / disables notifications on that device). */
export async function deleteUserToken(userId: string, fcmToken: string): Promise<void> {
    await db.orm.public.UserFCMToken.where({ userId, fcmToken }).delete();
}
