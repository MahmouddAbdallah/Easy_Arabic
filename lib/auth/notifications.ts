import 'server-only';
import { sendNotification } from '@/components/notification/lib/sendNotification';
import { getAdminIds } from '@/lib/profile/service';

/**
 * Fire-and-forget: call it inside `after(() => ...)` so it stays off the response's critical path.
 * `sendNotification` never throws, and nothing here is allowed to fail a request. Text is deliberately
 * generic: lock screens show it to bystanders, so it carries the customer's name and never their
 * email or phone number.
 */

/** Tells every admin that a new customer just created an account. Never notifies the customer. */
export async function notifyAdminsOfNewCustomer(customerId: string, customerName: string) {
    try {
        const userIds = (await getAdminIds()).filter((id) => id !== customerId);
        if (userIds.length === 0) return;
        await sendNotification({
            userIds,
            type: 'create_account',
            title: 'New customer registered',
            body: `${customerName} just created an account.`,
            link: `/dashboard/families/${customerId}`,
            // One notification per customer. `create_account` is identified by its content, so without a
            // tag two sign-ups with similar text could overwrite each other; with one, a repeat for the
            // same customer updates the stored copy instead of adding another.
            tag: `new-customer:${customerId}`,
        });
    } catch (error) {
        console.error('[auth] could not notify admins of the new customer:', error);
    }
}
export async function notifyAdminsOfForgotPassword(customerId: string, customerName: string) {
    try {
        const userIds = (await getAdminIds()).filter((id) => id !== customerId);
        if (userIds.length === 0) return;
        await sendNotification({
            userIds,
            type: 'create_account',
            title: 'Forgot password',
            body: `${customerName} forgot his password.`,
            link: `/dashboard/families/${customerId}`,
            // One notification per customer. `create_account` is identified by its content, so without a
            // tag two sign-ups with similar text could overwrite each other; with one, a repeat for the
            // same customer updates the stored copy instead of adding another.
            tag: `new-customer:${customerId}`,
        });
    } catch (error) {
        console.error('[auth] could not notify admins of the new customer:', error);
    }
}
