'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { isPushSupported, removeDeviceToken, syncDeviceToken } from '../lib/client/device';

export interface PushRegistration {
    /** Can this browser receive web push? `null` while still checking. */
    isSupported: boolean | null;
    permission: NotificationPermission;
    /** Is this browser's token saved on the server for the signed-in user? */
    isRegistered: boolean;
    /** Asks for permission (if needed) and registers this device. Resolves to whether it is registered. */
    enableNotifications: () => Promise<boolean>;
    /** Removes this device from the server and revokes its token. Call it BEFORE signing out. */
    unregisterDevice: () => Promise<void>;
}

/**
 * This browser as a push target for `userId`: feature support, permission state, and keeping its FCM
 * token registered on the server — automatically once permission is granted, or on demand through
 * `enableNotifications`. Showing notifications is not its job (see useServiceWorkerBridge).
 */
export function usePushRegistration(userId: string | undefined): PushRegistration {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [support, setSupport] = useState<boolean | null>(null); // null = still checking
    const [isRegistered, setIsRegistered] = useState(false);

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

    useEffect(() => {
        if (!userId || permission !== 'granted' || support !== true) return;

        let active = true;
        void syncDeviceToken(userId).then((registered) => {
            if (active) setIsRegistered(registered);
        });
        return () => {
            active = false;
        };
    }, [userId, permission, support]);

    const enableNotifications = useCallback(async () => {
        if (support !== true) return false;
        if (!userId) {
            toast.error('Please sign in to enable notifications.');
            return false;
        }

        try {
            const result = await Notification.requestPermission();
            setPermission(result);
            if (result !== 'granted') return false;

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

    const unregisterDevice = useCallback(async () => {
        await removeDeviceToken();
        setIsRegistered(false);
    }, []);

    return useMemo(
        () => ({
            isSupported: support,
            permission,
            isRegistered: isRegistered && Boolean(userId),
            enableNotifications,
            unregisterDevice,
        }),
        [support, permission, isRegistered, userId, enableNotifications, unregisterDevice]
    );
}
