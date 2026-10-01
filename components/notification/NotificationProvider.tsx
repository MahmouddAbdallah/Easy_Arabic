'use client';

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    getMessaging,
    getToken,
    isSupported,
    onMessage,
    type Messaging,
} from 'firebase/messaging';
import axios from 'axios';

import { firebaseClientApp } from '@/lib/config/firebase-client';
import { Button } from '../ui/button';

interface NotificationContextType {
    permission: NotificationPermission;
    isRegistering: boolean;
    requestPermissionAndRegister: () => Promise<void>;
}

const NotificationContext = createContext<
    NotificationContextType | undefined
>(undefined);

export function NotificationProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [permission, setPermission] =
        useState<NotificationPermission>('default');

    const [isRegistering, setIsRegistering] = useState(false);

    const messagingRef = useRef<Messaging | null>(null);

    /**
     * Get Firebase Messaging instance only in the browser.
     */
    const getMessagingInstance = useCallback(async () => {
        if (typeof window === 'undefined') {
            return null;
        }

        try {
            const supported = await isSupported();

            if (!supported) {
                console.warn('Firebase Messaging is not supported.');
                return null;
            }

            if (!messagingRef.current) {
                messagingRef.current = getMessaging(firebaseClientApp);
            }

            return messagingRef.current;
        } catch (error) {
            console.error(
                'Failed to initialize Firebase Messaging:',
                error
            );

            return null;
        }
    }, []);

    /**
     * Read current browser notification permission.
     */
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        if (!('Notification' in window)) {
            return;
        }

        setPermission(Notification.permission);
    }, []);

    /**
     * Listen for foreground Firebase messages.
     */
    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        const setupForegroundListener = async () => {
            if (typeof window === 'undefined') {
                return;
            }

            if (!('Notification' in window)) {
                return;
            }

            if (Notification.permission !== 'granted') {
                return;
            }

            const messaging = await getMessagingInstance();

            if (!messaging) {
                return;
            }

            unsubscribe = onMessage(messaging, (payload) => {
                console.log('Received foreground FCM message:', payload);

                // You can handle foreground notifications here.
                // Example:
                // toast({
                //   title: payload.notification?.title,
                //   description: payload.notification?.body,
                // });
            });
        };

        void setupForegroundListener();

        return () => {
            unsubscribe?.();
        };
    }, [getMessagingInstance]);

    /**
     * Request notification permission and register FCM token.
     */
    const requestPermissionAndRegister = useCallback(async () => {
        if (typeof window === 'undefined') {
            return;
        }

        if (!('Notification' in window)) {
            console.warn('Browser notifications are not supported.');
            return;
        }

        if (isRegistering) {
            return;
        }

        try {
            setIsRegistering(true);

            const currentPermission =
                await Notification.requestPermission();

            setPermission(currentPermission);

            if (currentPermission !== 'granted') {
                return;
            }

            const messaging = await getMessagingInstance();

            if (!messaging) {
                return;
            }

            /**
             * Get FCM token.
             *
             * Firebase will use:
             * /firebase-messaging-sw.js
             *
             * Make sure that file exists in /public.
             */
            const token = await getToken(messaging, {
                vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
            });

            if (!token) {
                console.warn('FCM token was not generated.');
                return;
            }

            await axios.post('/api/notification/fcm-token', {
                fcmToken: token,
                deviceType: navigator.userAgent,
            });

            console.log('FCM token registered successfully.');
        } catch (error) {
            console.error(
                'Failed to request notification permission:',
                error
            );
        } finally {
            setIsRegistering(false);
        }
    }, [getMessagingInstance, isRegistering]);

    const contextValue: NotificationContextType = {
        permission,
        isRegistering,
        requestPermissionAndRegister,
    };

    return (
        <NotificationContext.Provider value={contextValue}>
            <div className="flex flex-col gap-4">
                <Button
                    type="button"
                    onClick={requestPermissionAndRegister}
                    disabled={
                        isRegistering ||
                        permission === 'granted' ||
                        permission === 'denied'
                    }
                    className="px-4 py-2"
                >
                    {isRegistering && 'Enabling Notifications...'}
                    {!isRegistering &&
                        permission === 'default' &&
                        'Enable Notifications'}
                    {!isRegistering &&
                        permission === 'granted' &&
                        'Notifications Enabled'}
                    {!isRegistering &&
                        permission === 'denied' &&
                        'Notifications Denied'}
                </Button>

                {children}
            </div>
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);

    if (!context) {
        throw new Error(
            'useNotification must be used within a NotificationProvider'
        );
    }

    return context;
}