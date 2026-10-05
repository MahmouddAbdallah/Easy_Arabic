'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
    PUSH_OPT_OUT_PREFIX,
    forgetRegistration,
    isPushOptedOut,
    isPushSupported,
    removeDeviceToken,
    setPushOptOut,
    syncDeviceToken,
} from '../lib/client/device';
import { promptGate } from '../lib/client/promptGate';

export interface PushRegistration {
    /** Can this browser receive web push? `null` while still checking. */
    isSupported: boolean | null;
    /** The browser's own permission for notifications — the source of truth for whether we may ask. */
    permission: NotificationPermission;
    /** Is this browser's token saved on the server for the signed-in user? */
    isRegistered: boolean;
    /** The person turned push off on this device (the browser permission may still be granted). */
    isOptedOut: boolean;
    /** Push is working on this device: permitted, not turned off, and registered. */
    isActive: boolean;
    /**
     * Turns push on for this device: asks the browser for permission if it has not been decided, then
     * registers the device. Never asks a browser that has already said no. Resolves to whether push is now on.
     */
    enableNotifications: () => Promise<boolean>;
    /** Turns push off for this device only: forgets its token. Permission stays as the browser has it. */
    disableNotifications: () => Promise<void>;
    /** Removes this device from the server and revokes its token. Call it BEFORE signing out. */
    unregisterDevice: () => Promise<void>;
}

/**
 * This browser as a push target for `userId`: feature support, permission state, and keeping its FCM
 * token registered on the server — automatically once permission is granted (unless the person turned push
 * off on this device), or on demand through `enableNotifications`. Showing notifications is not its job (see
 * useServiceWorkerBridge).
 */
export function usePushRegistration(userId: string | undefined): PushRegistration {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [support, setSupport] = useState<boolean | null>(null); // null = still checking
    const [isRegistered, setIsRegistered] = useState(false);
    const [isOptedOut, setIsOptedOut] = useState(false);

    useEffect(() => {
        let active = true;
        if ('Notification' in window) setPermission(Notification.permission);
        void isPushSupported().then((supported) => {
            if (active) setSupport(supported);
        });
        return () => {
            active = false;
        };
    }, []);

    // The permission can change outside the app (the address-bar lock, the browser's settings page).
    // Follow it, so a person who unblocks notifications there is registered without a reload.
    useEffect(() => {
        if (!('Notification' in window)) return;

        const refresh = () => setPermission(Notification.permission);
        let status: PermissionStatus | undefined;
        navigator.permissions
            ?.query({ name: 'notifications' })
            .then((result) => {
                status = result;
                result.onchange = refresh;
            })
            .catch(() => {
                /* not supported for notifications in this browser — the visibility check below still covers it */
            });
        document.addEventListener('visibilitychange', refresh);

        return () => {
            document.removeEventListener('visibilitychange', refresh);
            if (status) status.onchange = null;
        };
    }, []);

    // "Not on this device" is kept in localStorage, so another tab can change it.
    useEffect(() => {
        if (!userId) {
            setIsOptedOut(false);
            return;
        }
        setIsOptedOut(isPushOptedOut(userId));

        const onStorage = (event: StorageEvent) => {
            if (event.key === PUSH_OPT_OUT_PREFIX + userId) setIsOptedOut(isPushOptedOut(userId));
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [userId]);

    useEffect(() => {
        if (!userId || support !== true) return;

        if (permission !== 'granted') {
            // Whatever registration there was is gone with the permission; a later grant must start over.
            forgetRegistration();
            setIsRegistered(false);
            return;
        }
        if (isOptedOut) {
            setIsRegistered(false);
            return;
        }

        let active = true;
        void syncDeviceToken(userId).then((registered) => {
            if (active) setIsRegistered(registered);
        });
        return () => {
            active = false;
        };
    }, [userId, permission, support, isOptedOut]);

    const enableNotifications = useCallback(async () => {
        if (support !== true) return false;
        if (!userId) {
            toast.error('Please sign in to enable notifications.');
            return false;
        }

        try {
            // Only ask while the browser still can show its dialog. After a "Block" it never will, and
            // calling requestPermission() again would only be ignored.
            let result = Notification.permission;
            if (result === 'default') {
                result = await Notification.requestPermission();
                setPermission(result);
            }
            if (result !== 'granted') {
                // Rejected, or the dialog was closed: our own prompt rests for a week.
                promptGate.recordDismissal(userId);
                return false;
            }

            setPushOptOut(userId, false);
            setIsOptedOut(false);
            const registered = await syncDeviceToken(userId, { force: true });
            setIsRegistered(registered);
            if (!registered) toast.error('Could not enable notifications. Please try again.');
            return registered;
        } catch (error) {
            console.error('[notification] Could not enable notifications:', error);
            toast.error('Could not enable notifications. Please try again.');
            return false;
        }
    }, [support, userId]);

    const disableNotifications = useCallback(async () => {
        if (!userId) return;
        // Record the choice first, so the registration effect does not undo it.
        setPushOptOut(userId, true);
        setIsOptedOut(true);
        await removeDeviceToken();
        setIsRegistered(false);
    }, [userId]);

    const unregisterDevice = useCallback(async () => {
        await removeDeviceToken();
        setIsRegistered(false);
    }, []);

    return useMemo(
        () => ({
            isSupported: support,
            permission,
            isRegistered: isRegistered && Boolean(userId),
            isOptedOut,
            isActive: isRegistered && Boolean(userId) && permission === 'granted' && !isOptedOut,
            enableNotifications,
            disableNotifications,
            unregisterDevice,
        }),
        [support, permission, isRegistered, isOptedOut, userId, enableNotifications, disableNotifications, unregisterDevice]
    );
}
