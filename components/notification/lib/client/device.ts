/**
 * CLIENT ONLY — browser APIs and the Firebase web SDK. Never import this from server code.
 *
 * This browser as a push target: feature detection, obtaining its FCM token and keeping that token
 * registered with the server. Receiving and showing notifications is the service worker's job
 * (public/firebase-messaging-sw.js) plus the NotificationProvider; neither needs Firebase's `onMessage`.
 */
import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import { firebaseClientApp } from '@/lib/config/firebase-client';
import { registerDevice, unregisterDevice } from './api';

/**
 * localStorage marker `{ device: "userId:token", at }` — "this browser's token is already saved on the
 * server for this user". It is shared by every tab and survives restarts, so opening a tab does not cost
 * a request (and two database queries) every time. It expires so a registration the server lost is
 * eventually healed, and it names the user, so signing in as someone else registers the device again.
 */
const SYNC_MARKER_KEY = 'notification:registered-device';
const SYNC_MARKER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * "Not on this device": the person turned push off here in the settings while the browser permission is
 * still granted. It is a choice about THIS browser, so it lives here and not in the account's settings (the
 * same person's phone is unaffected). Named per user so a different account on a shared browser starts fresh.
 */
export const PUSH_OPT_OUT_PREFIX = 'notification:push-opt-out:';

export function isPushOptedOut(userId: string): boolean {
    try {
        return localStorage.getItem(PUSH_OPT_OUT_PREFIX + userId) === '1';
    } catch {
        return false;
    }
}

export function setPushOptOut(userId: string, optedOut: boolean): void {
    try {
        if (optedOut) localStorage.setItem(PUSH_OPT_OUT_PREFIX + userId, '1');
        else localStorage.removeItem(PUSH_OPT_OUT_PREFIX + userId);
    } catch {
        /* ignore */
    }
}

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

function isRegisteredHere(device: string): boolean {
    try {
        const marker: unknown = JSON.parse(localStorage.getItem(SYNC_MARKER_KEY) ?? 'null');
        if (typeof marker !== 'object' || marker === null) return false;
        const { device: markedDevice, at } = marker as { device?: unknown; at?: unknown };
        return markedDevice === device && typeof at === 'number' && Date.now() - at < SYNC_MARKER_TTL_MS;
    } catch {
        return false; // storage can be unavailable (private mode, blocked cookies) or hold junk
    }
}

function markRegisteredHere(device: string | null): void {
    try {
        if (device === null) localStorage.removeItem(SYNC_MARKER_KEY);
        else localStorage.setItem(SYNC_MARKER_KEY, JSON.stringify({ device, at: Date.now() }));
    } catch {
        /* ignore */
    }
}

/** Forgets that this browser is registered, so the next permission grant registers it again from scratch. */
export function forgetRegistration(): void {
    markRegisteredHere(null);
}

/** One registration at a time per user, even if several components/effects ask at once. */
const inFlight = new Map<string, Promise<boolean>>();

/**
 * Makes sure this browser's token is saved on the server for `userId`. Safe to call repeatedly:
 * concurrent calls share one request, and the browser only re-registers when the user or token changed
 * (or the marker expired). Resolves to whether the device is registered; never rejects.
 */
export function syncDeviceToken(userId: string, options: { force?: boolean } = {}): Promise<boolean> {
    const pending = inFlight.get(userId);
    if (pending) return pending;

    const task = (async () => {
        const token = await getDeviceToken();
        if (!token) return false;

        const device = `${userId}:${token}`;
        if (!options.force && isRegisteredHere(device)) return true;

        await registerDevice(token, navigator.userAgent.slice(0, 255));
        markRegisteredHere(device);
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
            await unregisterDevice(token).catch((error) => {
                console.error('[notification] Could not remove this device on the server:', error);
            });
        }
        await deleteToken(getMessaging(firebaseClientApp));
    } catch (error) {
        console.error('[notification] Could not revoke this device\'s push token:', error);
    } finally {
        markRegisteredHere(null);
    }
}
