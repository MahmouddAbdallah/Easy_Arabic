'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SW_MESSAGE, isSafeInternalLink, parseServiceWorkerMessage, type NotificationPayload } from '../lib/contract';

/**
 * The page's end of the service worker (public/firebase-messaging-sw.js): while the app is open the
 * worker hands every incoming push to the page instead of drawing a system notification, and tells the
 * page to navigate when a system notification is clicked. This passes the former to `onReceived` (the
 * alert center decides whether it becomes a pop-up and a sound) and performs the latter with the app's
 * own router (instant, no reload).
 *
 * Every message is confirmed on the channel the worker opened — that confirmation is how the worker
 * knows a page took it and no system notification is needed. The page confirms even when the person's
 * settings say not to show a pop-up: they are looking at the app, so a system notification on top would
 * be the very duplication they opted out of.
 */
export function useServiceWorkerBridge(onReceived: (payload: NotificationPayload) => void): void {
    const router = useRouter();

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
                onReceived(message.payload);
            }
            event.ports[0]?.postMessage({ handled: true });
        };

        navigator.serviceWorker.addEventListener('message', onMessage);
        return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    }, [openLink, onReceived]);
}
