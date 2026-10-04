'use client';

import React, { Suspense, createContext, useContext } from 'react';
import { useAppContext } from '../AppContext';
import { Button } from '../ui/button';
import { ActiveContextReporter } from './ActiveContextReporter';
import { usePushRegistration, type PushRegistration } from './hooks/usePushRegistration';
import { useServiceWorkerBridge } from './hooks/useServiceWorkerBridge';

const NotificationContext = createContext<PushRegistration | undefined>(undefined);

/**
 * Push notifications for the whole app. It only composes three independent pieces:
 *   - usePushRegistration    registers this device's FCM token and exposes permission state;
 *   - useServiceWorkerBridge shows incoming pushes as in-app toasts while the app is open (the service
 *                            worker shows them as system notifications otherwise);
 *   - ActiveContextReporter  reports which page this tab shows, so notifications about a page the user is
 *                            already on are never sent.
 * Renders no UI of its own — place <NotificationPermissionButton /> where the user should be able to
 * enable notifications. The in-app notification LIST is unrelated: see NotificationBody.
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAppContext();
    const userId = user?.id;

    const push = usePushRegistration(userId);
    useServiceWorkerBridge();

    return (
        <NotificationContext.Provider value={push}>
            <Suspense fallback={null}>
                <ActiveContextReporter userId={userId} />
            </Suspense>
            {children}
        </NotificationContext.Provider>
    );
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
