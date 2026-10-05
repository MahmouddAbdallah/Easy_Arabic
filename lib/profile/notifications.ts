import 'server-only';
import { sendNotification } from '@/components/notification/lib/sendNotification';
import { getAdminIds } from './service';

/**
 * Both helpers are fire-and-forget: call them inside `after(() => ...)` so they stay off the
 * response's critical path. `sendNotification` never throws, and nothing here is allowed to
 * fail a request. Text is deliberately generic: lock screens show it to bystanders, so it
 * never contains the requested values.
 */

export async function notifyAdminsOfNewRequest(requestId: string, familyName: string) {
    try {
        const userIds = await getAdminIds();
        if (userIds.length === 0) return;
        await sendNotification({
            userIds,
            type: 'general',
            title: 'New profile change request',
            body: `${familyName} asked to update their profile details.`,
            link: '/dashboard/profile-requests',
            tag: `profile-request:${requestId}`,
        });
    } catch (error) {
        console.error('[profile] could not notify admins:', error);
    }
}

export async function notifyCustomerOfDecision(familyId: string, requestId: string, approved: boolean) {
    try {
        await sendNotification({
            userId: familyId,
            type: 'general',
            title: approved ? 'Profile change approved' : 'Profile change not approved',
            body: approved
                ? 'The admin approved your request and your profile was updated.'
                : 'The admin reviewed your request. Open your profile to read the reply.',
            link: '/profile',
            tag: `profile-request:${requestId}`,
        });
    } catch (error) {
        console.error('[profile] could not notify the customer:', error);
    }
}
