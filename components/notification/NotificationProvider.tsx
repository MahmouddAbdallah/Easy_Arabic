'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useAppContext } from '../AppContext';
import { Button } from '../ui/button';
import { NotificationToast } from './NotificationToast';
import { isPushSupported, removeDeviceToken, syncDeviceToken } from './lib/client';
import { SW_MESSAGE, isSafeInternalLink, parseServiceWorkerMessage, type NotificationPayload, } from './lib/contract';

const IN_APP_TOAST_MS = 6000;

interface NotificationContextType {
    isSupported: boolean | null;
    permission: NotificationPermission;
    isRegistered: boolean;
    enableNotifications: () => Promise<boolean>;
    unregisterDevice: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function showInAppNotification(payload: NotificationPayload, open: (link?: string) => void) {
    toast.custom(
        (t) => (
            <NotificationToast
                payload={payload}
                visible={t.visible}
                onOpen={() => {
                    toast.dismiss(t.id);
                    open(payload.link);
                }}
                onDismiss={() => toast.dismiss(t.id)}
            />
        ),
        { id: payload.tag ?? payload.id, duration: IN_APP_TOAST_MS }
    );
}

/**
 * Push notifications for the whole app: registers this device's FCM token and shows incoming push
 * notifications as in-app toasts while the app is open (the service worker shows them as system
 * notifications otherwise). Renders no UI of its own — place <NotificationPermissionButton /> where
 * the user should be able to enable notifications. The in-app notification LIST is unrelated: see
 * NotificationBody.
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { user } = useAppContext();
    const userId = user?.id;

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

    const openLink = useCallback(
        (link?: string) => {
            if (isSafeInternalLink(link)) router.push(link);
        },
        [router]
    );

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;
        const onMessage = (event: MessageEvent) => {
            const message = parseServiceWorkerMessage(event.data);
            if (!message) return;

            if (message.type === SW_MESSAGE.CLICK) {
                openLink(message.link);
            } else {
                showInAppNotification(message.payload, openLink);
            }
            event.ports[0]?.postMessage({ handled: true });
        };

        navigator.serviceWorker.addEventListener('message', onMessage);
        return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    }, [openLink]);

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

    const value = useMemo<NotificationContextType>(
        () => ({
            isSupported: support,
            permission,
            isRegistered: isRegistered && Boolean(userId),
            enableNotifications,
            unregisterDevice,
        }),
        [support, permission, isRegistered, userId, enableNotifications, unregisterDevice]
    );

    return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

/** The "Enable Notifications" button. Must be rendered inside <NotificationProvider>. */
export function NotificationPermissionButton({ className }: { className?: string }) {
    const { isSupported, permission, enableNotifications } = useNotification();

    const label =
        isSupported === false
            ? 'Notifications Not Supported'
            : {
                default: 'Enable Notifications',
                granted: 'Notifications Enabled',
                denied: 'Notifications Blocked',
            }[permission];

    return (
        <Button
            type="button"
            onClick={() => void enableNotifications()}
            disabled={isSupported !== true || permission !== 'default'}
            className={className}
        >
            {label}
        </Button>
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
}
