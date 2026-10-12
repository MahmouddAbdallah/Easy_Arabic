/**
 * CLIENT ONLY — browser APIs and the Firebase web SDK. Never import this from server code.
 *
 * This browser as a push target: feature detection, obtaining its FCM token and keeping that token
 * registered with the server. Receiving and showing notifications is the service worker's job
 * (public/firebase-messaging-sw.js) plus the NotificationProvider; neither needs Firebase's `onMessage`.
 *
 * Firebase's messaging SDK is not part of the app's first load: it is fetched the first time something in
 * here needs it (`loadMessagingSdk`), so a page does not carry it before it knows push can be used.
 */
import type * as MessagingSdk from 'firebase/messaging';
import { firebaseClientApp } from '@/lib/config/firebase-client';
import { registerDevice, unregisterDevice } from './api';
import { withCrossTabLock } from './locks';

/**
 * localStorage marker `{ device: "userId:token", at }` — "this browser's token is already saved on the
 * server for this user". It is shared by every tab and survives restarts, so opening a tab does not cost
 * a request (and two database queries) every time. It expires so a registration the server lost is
 * eventually healed, and it names the user, so signing in as someone else registers the device again.
 */
const SYNC_MARKER_KEY = 'notification:registered-device';
const SYNC_MARKER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The cross-tab lock that registering and removing this browser's token both take, so two tabs never do either
 * at the same moment.
 */
const DEVICE_LOCK = 'notification:device';

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

/**
 * Firebase's messaging SDK, downloaded on first use. A download that fails is not remembered, so a later caller tries
 * again. The support check runs only once per page view, though (usePushRegistration): if the download fails there,
 * this page view treats the browser as unable to do push until it is reloaded.
 */
let messagingSdk: Promise<typeof MessagingSdk> | undefined;

function loadMessagingSdk(): Promise<typeof MessagingSdk> {
    messagingSdk ??= import('firebase/messaging').catch((error: unknown) => {
        messagingSdk = undefined;
        throw error;
    });
    return messagingSdk;
}

/** Can this browser receive web push at all? (false e.g. on iOS Safari outside an installed web app) */
export async function isPushSupported(): Promise<boolean> {
    // The first things Firebase's own check looks at, answered here so a browser that fails them never downloads the SDK.
    if (
        typeof window === 'undefined' ||
        !('Notification' in window) ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window)
    ) {
        return false;
    }
    try {
        return await (await loadMessagingSdk()).isSupported();
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
    const { getMessaging, getToken } = await loadMessagingSdk();
    const token = await getToken(getMessaging(firebaseClientApp), { vapidKey });
    return token || null;
}

/** What the marker names: this user, on this browser's current token. */
const deviceKey = (userId: string, token: string) => `${userId}:${token}`;

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

/**
 * Saves `token` on the server for `userId`, unless this browser already did. The check and the save happen under a
 * cross-tab lock: when several tabs find the registration missing at the same moment (a restored session, an
 * expired marker, a different user), one saves it and the others find the marker it wrote — one request (and
 * its database queries), not one per tab. `force` saves it regardless (the person has just turned push on).
 * Resolves to whether the device is registered; rejects if the save fails.
 */
export function registerDeviceOnce(userId: string, token: string, force = false): Promise<boolean> {
    const device = deviceKey(userId, token);
    return withCrossTabLock(DEVICE_LOCK, async () => {
        if (!force) {
            if (isRegisteredHere(device)) return true;
            if (isPushOptedOut(userId)) return false; // turned off in another tab while this one waited its turn
        }
        await registerDevice(token, navigator.userAgent.slice(0, 255));
        markRegisteredHere(device);
        return true;
    });
}

/** One registration at a time per user, even if several components/effects ask at once. */
const inFlight = new Map<string, Promise<boolean>>();

/**
 * Makes sure this browser's token is saved on the server for `userId`. Safe to call repeatedly:
 * concurrent calls share one request, and the browser only re-registers when the user or token changed
 * (or the marker expired) — and when several tabs need to, one of them does it (`registerDeviceOnce`).
 * Resolves to whether the device is registered; never rejects.
 */
export function syncDeviceToken(userId: string, options: { force?: boolean } = {}): Promise<boolean> {
    const pending = inFlight.get(userId);
    if (pending) return pending;

    const task = (async () => {
        const token = await getDeviceToken();
        if (!token) return false;

        // Registered already — the usual case on every page load: no lock, no request.
        if (!options.force && isRegisteredHere(deviceKey(userId, token))) return true;
        return registerDeviceOnce(userId, token, options.force);
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

    // Under the lock registering takes: a registration that is already waiting for it finishes first and is then undone,
    // never the other way round. One that is still fetching its token has not asked for the lock yet: for "off on this
    // device" the opt-out its caller sets first stops it, and any other token that slips through is dead by then — the
    // server drops it on the next send.
    await withCrossTabLock(DEVICE_LOCK, async () => {
        try {
            const { deleteToken, getMessaging } = await loadMessagingSdk();
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
    });
}
