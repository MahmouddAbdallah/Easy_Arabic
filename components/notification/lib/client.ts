/**
 * CLIENT ONLY — browser APIs and the Firebase web SDK. Never import this from server code.
 *
 * Everything the browser needs to be a notification target: feature detection, obtaining this
 * browser's FCM token, keeping that token registered with the server, and telling the server which
 * page this tab is showing. Receiving and showing notifications is the service worker's job
 * (public/firebase-messaging-sw.js) plus the NotificationProvider; neither needs Firebase's `onMessage`.
 */
import axios from 'axios';
import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import { firebaseClientApp } from '@/lib/config/firebase-client';
import {
    ACTIVE_CONTEXT_ENDPOINT,
    ACTIVE_CONTEXT_HEARTBEAT_MS,
    FCM_TOKEN_ENDPOINT,
    NOTIFICATION_HANDLED_ENDPOINT,
} from './contract';

/** sessionStorage marker "userId:token" — lets a tab skip re-registering a device it already registered. */
const SYNC_MARKER_KEY = 'notification:registered-device';

/** Can this browser receive web push at all? (false e.g. on iOS Safari outside an installed web app) */
export async function isPushSupported(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    try {
        return await isSupported();
    } catch {
        return false;
    }
}

/**
 * This browser's FCM token. Also registers the service worker (/firebase-messaging-sw.js) on first
 * use. Only call it once notification permission is granted.
 */
export async function getDeviceToken(): Promise<string | null> {
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
        console.error('[notification] NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set — cannot get a push token.');
        return null;
    }
    const token = await getToken(getMessaging(firebaseClientApp), { vapidKey });
    return token || null;
}

function readSyncMarker(): string | null {
    try {
        return sessionStorage.getItem(SYNC_MARKER_KEY);
    } catch {
        return null; // storage can be unavailable (private mode, blocked cookies)
    }
}

function writeSyncMarker(value: string | null): void {
    try {
        if (value === null) sessionStorage.removeItem(SYNC_MARKER_KEY);
        else sessionStorage.setItem(SYNC_MARKER_KEY, value);
    } catch {
        /* ignore */
    }
}

/** One registration at a time per user, even if several components/effects ask at once. */
const inFlight = new Map<string, Promise<boolean>>();

/**
 * Makes sure this browser's token is saved on the server for `userId`. Safe to call repeatedly:
 * concurrent calls share one request, and a tab only re-registers when the user or token changed.
 * Resolves to whether the device is registered; never rejects.
 */
export function syncDeviceToken(userId: string, options: { force?: boolean } = {}): Promise<boolean> {
    const pending = inFlight.get(userId);
    if (pending) return pending;

    const task = (async () => {
        const token = await getDeviceToken();
        if (!token) return false;

        const marker = `${userId}:${token}`;
        if (!options.force && readSyncMarker() === marker) return true;

        await axios.post(FCM_TOKEN_ENDPOINT, {
            fcmToken: token,
            deviceType: navigator.userAgent.slice(0, 255),
        });
        writeSyncMarker(marker);
        return true;
    })()
        .catch((error) => {
            console.error('[notification] Could not register this device for notifications:', error);
            return false;
        })
        .finally(() => inFlight.delete(userId));

    inFlight.set(userId, task);
    return task;
}

/**
 * Stops notifications on this device: removes its token from the server and revokes it at FCM.
 * Call it BEFORE the user signs out, while the session can still authorise the request.
 * Never rejects; if the server call fails the token is still revoked at FCM, so it simply goes
 * dead and gets cleaned up on the next send.
 */
export async function removeDeviceToken(): Promise<void> {
    if (!(await isPushSupported()) || Notification.permission !== 'granted') return;

    try {
        const token = await getDeviceToken();
        if (token) {
            await axios.delete(FCM_TOKEN_ENDPOINT, { data: { fcmToken: token } }).catch((error) => {
                console.error('[notification] Could not remove this device on the server:', error);
            });
        }
        await deleteToken(getMessaging(firebaseClientApp));
    } catch (error) {
        console.error('[notification] Could not revoke this device\'s push token:', error);
    } finally {
        writeSyncMarker(null);
    }
}

// ─── Clicked notifications ────────────────────────────────────────────────────

/**
 * Tells the server the user clicked the delivered notification `key` (NotificationPayload.key), so its
 * stored copy is deleted. Best-effort: if the request fails the notification simply stays in the list as
 * unread, which is the safe outcome. `keepalive` lets it finish even if the click navigates away.
 */
export function markNotificationHandled(key: string): void {
    fetch(NOTIFICATION_HANDLED_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
        keepalive: true,
    }).catch(() => {
        /* ignore */
    });
}

// ─── What this tab is showing ─────────────────────────────────────────────────

let tabId: string | undefined;

/** Identifies this browser tab to the server; stays the same while the tab lives. */
function getTabId(): string {
    // crypto.randomUUID only exists in secure contexts (https / localhost).
    return (tabId ??= globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);
}

/**
 * Best-effort: if a report never arrives the server simply stops trusting the previous one after its
 * TTL. `keepalive` lets the "no longer visible" report outlive a page that is closing.
 */
function reportActiveContext(link: string | null): void {
    fetch(ACTIVE_CONTEXT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: getTabId(), link }),
        keepalive: true,
    }).catch(() => {
        /* ignore */
    });
}

/**
 * Tells the server this tab is showing `location` ("/path?query") for as long as the tab is visible:
 * once now, again on every heartbeat, and a "not visible" report when the tab is hidden or closed.
 * Call the returned function to stop. Changing location is just stopping and tracking the new one —
 * the new report replaces this tab's previous one on the server.
 */
export function trackActiveContext(location: string): () => void {
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    const sync = () => {
        clearInterval(heartbeat);
        if (document.visibilityState === 'visible') {
            reportActiveContext(location);
            heartbeat = setInterval(() => reportActiveContext(location), ACTIVE_CONTEXT_HEARTBEAT_MS);
        } else {
            reportActiveContext(null);
        }
    };

    sync();
    document.addEventListener('visibilitychange', sync);

    return () => {
        clearInterval(heartbeat);
        document.removeEventListener('visibilitychange', sync);
    };
}
