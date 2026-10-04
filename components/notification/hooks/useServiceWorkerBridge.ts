'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { showNotificationToast } from '../NotificationToast';
import { SW_MESSAGE, isSafeInternalLink, parseServiceWorkerMessage } from '../lib/contract';

/**
 * The page's end of the service worker (public/firebase-messaging-sw.js): while the app is open the
 * worker hands every incoming push to the page instead of drawing a system notification, and tells the
 * page to navigate when a system notification is clicked. This shows the former as an in-app toast and
 * performs the latter with the app's own router (instant, no reload).
 *
 * Every message is confirmed on the channel the worker opened — that confirmation is how the worker
 * knows a page took it and no system notification is needed.
 */
export function useServiceWorkerBridge(): void {
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
                showNotificationToast(message.payload, openLink);
            }
            event.ports[0]?.postMessage({ handled: true });
        };

        navigator.serviceWorker.addEventListener('message', onMessage);
        return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    }, [openLink]);
}
