/**
 * SERVER ONLY — compatibility entry point, kept so code outside this folder (the chat's call notifications)
 * keeps working with the import path it already uses. The implementation lives in ./server/devices.ts, the
 * same module sendNotification() and the fcm-token route use.
 */
import { getDevicesForUsers } from './server/devices';

export { deleteTokens, deleteUserToken, registerUserToken } from './server/devices';

/** Every registered device token for the given users (de-duplicated). */
export async function getTokensForUsers(userIds: string[]): Promise<string[]> {
    return (await getDevicesForUsers(userIds)).map((device) => device.fcmToken);
}
