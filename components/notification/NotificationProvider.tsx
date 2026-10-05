'use client';

import React, { Suspense, createContext, useContext, useMemo } from 'react';
import { useAppContext } from '../AppContext';
import { Button } from '../ui/button';
import { ActiveContextReporter } from './ActiveContextReporter';
import { NotificationPermissionPrompt } from './NotificationPermissionPrompt';
import { useInAppAlerts } from './hooks/useInAppAlerts';
import { useNotificationSettingsState, type NotificationSettingsState } from './hooks/useNotificationSettingsState';
import { usePermissionPrompt } from './hooks/usePermissionPrompt';
import { usePushRegistration, type PushRegistration } from './hooks/usePushRegistration';
import { useServiceWorkerBridge } from './hooks/useServiceWorkerBridge';

const NotificationContext = createContext<PushRegistration | undefined>(undefined);
const SettingsContext = createContext<NotificationSettingsState | undefined>(undefined);

/**
 * Notifications for the whole app. It only composes independent pieces:
 *   - usePushRegistration          this device as a push target: permission state and its FCM token;
 *   - useNotificationSettingsState the user's settings (one Firestore document, saved through the API);
 *   - useInAppAlerts               pop-ups and sound for notifications that arrive while the app is open,
 *                                  whether they came as a push or as a new entry in the list;
 *   - useServiceWorkerBridge       hands pushes received by the service worker to the page, and performs
 *                                  navigation when a system notification is clicked;
 *   - usePermissionPrompt          decides when to offer to turn push on (never within 7 days of a dismissal);
 *   - ActiveContextReporter        tells the server which page this tab shows, so notifications about a page
 *                                  the user is already on are never sent.
 * Place <NotificationPermissionButton /> where the user should be able to enable push by hand. The in-app
 * notification LIST (and its settings) is NotificationBody.
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAppContext();
    const userId = user?.id;

    const push = usePushRegistration(userId);
    const settingsState = useNotificationSettingsState(userId);
    const offerPush = useInAppAlerts(userId, settingsState.settings);
    useServiceWorkerBridge(offerPush);
    const prompt = usePermissionPrompt({ userId, push, notificationsEnabled: settingsState.settings.enabled });

    return (
        <NotificationContext.Provider value={push}>
            <SettingsContext.Provider value={settingsState}>
                <Suspense fallback={null}>
                    <ActiveContextReporter userId={userId} />
                </Suspense>
                {children}
                <NotificationPermissionPrompt prompt={prompt} />
            </SettingsContext.Provider>
        </NotificationContext.Provider>
    );
}

/** The "Enable Notifications" button. Must be rendered inside <NotificationProvider>. */
export function NotificationPermissionButton({ className }: { className?: string }) {
    const { isSupported, permission, isOptedOut, enableNotifications } = useNotification();

    // A person who turned push off on this device while the browser still allows it can turn it back on here.
    const canEnable = isSupported === true && (permission === 'default' || (permission === 'granted' && isOptedOut));

    const label =
        isSupported === false
            ? 'Notifications Not Supported'
            : {
                  default: 'Enable Notifications',
                  granted: isOptedOut ? 'Enable Notifications' : 'Notifications Enabled',
                  denied: 'Notifications Blocked',
              }[permission];

    return (
        <Button type="button" onClick={() => void enableNotifications()} disabled={!canEnable} className={className}>
            {label}
        </Button>
    );
}

/** Push on this device. Must be used within a NotificationProvider. */
export function useNotification() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
}

/** The user's notification settings and a way to change them. Must be used within a NotificationProvider. */
export function useNotificationSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useNotificationSettings must be used within a NotificationProvider');
    }
    return context;
}

/**
 * Settings and push state when a NotificationProvider is present, `undefined` fields when not — for
 * components such as NotificationBody that work with or without it (their settings screen needs it).
 */
export function useOptionalNotificationControls() {
    const push = useContext(NotificationContext);
    const settingsState = useContext(SettingsContext);
    return useMemo(() => ({ push, settingsState }), [push, settingsState]);
}
