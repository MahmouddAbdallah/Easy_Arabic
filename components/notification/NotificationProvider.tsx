'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useAppContext } from '../AppContext';
import { Button } from '../ui/button';
import { NotificationBody } from './NotificationBody';
import { isPushSupported, removeDeviceToken, syncDeviceToken } from './lib/client';
import {
    SW_MESSAGE,
    isSafeInternalLink,
    parseServiceWorkerMessage,
    type NotificationPayload,
} from './lib/contract';

const IN_APP_TOAST_MS = 6000;

interface NotificationContextType {
    /**
     * false where web push can't work (e.g. iOS Safari outside an installed web app);
     * null for the first moment while the browser is still being checked.
     */
    isSupported: boolean | null;
    /** The browser's notification permission ('default' until the user answers the prompt). */
    permission: NotificationPermission;
    /** true once this device's token is saved on the server for the signed-in user. */
    isRegistered: boolean;
    /** Ask for permission (call from a click) and register this device. Resolves to success. */
    enableNotifications: () => Promise<boolean>;
    /** Stop notifications on this device. Call it BEFORE signing the user out. */
    unregisterDevice: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/** Shows a notification that arrived while the app is open as a toast. */
function showInAppNotification(payload: NotificationPayload, open: (link?: string) => void) {
    toast.custom(
        (t) => (
            <NotificationBody
                payload={payload}
                visible={t.visible}
                onOpen={() => {
                    toast.dismiss(t.id);
                    open(payload.link);
                }}
                onDismiss={() => toast.dismiss(t.id)}
            />
        ),
        // Same id → a repeated/updated notification replaces its toast instead of stacking another.
        { id: payload.tag ?? payload.id, duration: IN_APP_TOAST_MS }
    );
}

/**
 * Owns everything browser-side about notifications:
 *  - tracks permission and keeps this device's FCM token registered for the signed-in user
 *  - shows notifications that arrive while the app is open (the service worker forwards them)
 *  - navigates when a system notification is clicked
 *
 * Mount it ONCE. For notifications to work on every page, mount it in the root layout with
 * `showEnableButton={false}` (inside <AppProvider>, which it needs for the signed-in user) and
 * put <NotificationPermissionButton /> wherever users should be able to switch notifications on.
 * `showEnableButton` defaults to true, which is what the /notification page relies on.
 */
export function NotificationProvider({
    children,
    showEnableButton = true,
}: {
    children: React.ReactNode;
    showEnableButton?: boolean;
}) {
    const router = useRouter();
    const { user } = useAppContext();
    const userId = user?.id;

    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [support, setSupport] = useState<boolean | null>(null); // null = still checking
    const [isRegistered, setIsRegistered] = useState(false);

    // Browser capabilities and current permission (only knowable on the client).
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

    // The single listener for everything the service worker tells this page.
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
            // Tell the service worker this page handled it, so it doesn't also fall back to a
            // system notification or open a second window.
            event.ports[0]?.postMessage({ handled: true });
        };

        navigator.serviceWorker.addEventListener('message', onMessage);
        return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    }, [openLink]);

    // Permission already granted (earlier visit, other account…): (re)register this device for the
    // signed-in user. No-ops when this tab already did it for this user + token.
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

    return (
        <NotificationContext.Provider value={value}>
            {showEnableButton ? (
                <div className="flex flex-col gap-4">
                    <NotificationPermissionButton />
                    {children}
                </div>
            ) : (
                children
            )}
        </NotificationContext.Provider>
    );
}

/** The "Enable Notifications" button. Must be rendered inside <NotificationProvider>. */
export function NotificationPermissionButton() {
    const { isSupported, permission, enableNotifications } = useNotification();

    return (
        <Button
            type="button"
            onClick={() => void enableNotifications()}
            disabled={isSupported !== true || permission === 'granted'}
            className="px-4 py-2 bg-blue-600! text-white rounded disabled:bg-gray-400"
        >
            {isSupported === false && 'Notifications Not Supported'}
            {isSupported !== false && permission === 'default' && 'Enable Notifications'}
            {isSupported !== false && permission === 'granted' && 'Notifications Enabled'}
            {isSupported !== false && permission === 'denied' && 'Notifications Denied'}
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
