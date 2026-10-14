'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SW_MESSAGE, isSafeInternalLink, parseServiceWorkerMessage, type NotificationPayload } from '../lib/contract';

/**
 * The page's end of the service worker (public/firebase-messaging-sw.js): while the person is working in the
 * app (its tab visible and in focus) the worker hands every incoming push to the page instead of drawing a
 * system notification, and tells the page to navigate when a system notification is clicked. This passes the
 * former to `onReceived` (the alert center decides whether it becomes a pop-up and a sound) and performs the
 * latter with the app's own router (instant, no reload).
 *
 * Every message is answered on the channel the worker opened — that answer is how the worker knows whether a
 * page took it or a system notification is needed. `onReceived` says which: true when the notification was taken
 * in the app, which includes the person's settings saying not to show a pop-up (they are looking at the app, so a
 * system notification on top would be the very duplication they opted out of); false when nobody could see
 * anything after all (the tab went to the background a moment after the worker looked), and the worker then draws
 * the system notification itself.
 */
export function useServiceWorkerBridge(onReceived: (payload: NotificationPayload) => boolean): void {
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

            let handled = true;
            if (message.type === SW_MESSAGE.CLICK) {
                openLink(message.link);
            } else {
                handled = onReceived(message.payload);
            }
            event.ports[0]?.postMessage({ handled });
        };

        navigator.serviceWorker.addEventListener('message', onMessage);
        return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    }, [openLink, onReceived]);
}
