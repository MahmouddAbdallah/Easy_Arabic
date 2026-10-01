
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { firebaseClientApp } from '@/lib/config/firebase-client';
import { Button } from '../ui/button';
import axios from 'axios';

interface NotificationContextType {
    children?: React.ReactNode;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [permission, setPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    const requestPermissionAndRegister = async () => {
        try {
            if (typeof window === 'undefined' || !('Notification' in window)) return;

            const currentPermission = await Notification.requestPermission();
            setPermission(currentPermission);

            if (currentPermission !== 'granted') return;

            const messaging = getMessaging(firebaseClientApp);
            const token = await getToken(messaging, {
                vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
            });

            if (!token) return;


            const deviceType = navigator.userAgent;
            await axios.post('/api/notification/fcm-token', {
                fcmToken: token,
                deviceType
            });

            onMessage(messaging, (payload) => {
                console.log('Received foreground message:', payload);
            });

        } catch (error) {
            console.error('Error getting FCM token:', error);
        }
    };

    return (
        <NotificationContext.Provider
            value={{}}
        >
            <div className="flex flex-col gap-4">
                <Button
                    type="button"
                    onClick={requestPermissionAndRegister}
                    disabled={permission === 'granted'}
                    className="px-4 py-2 bg-blue-600! text-white rounded disabled:bg-gray-400"
                >
                    {permission === 'default' && 'Enable Notifications'}
                    {permission === 'granted' && 'Notifications Enabled'}
                    {permission === 'denied' && 'Notifications Denied'}
                </Button>

                {children}
            </div>
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
}
