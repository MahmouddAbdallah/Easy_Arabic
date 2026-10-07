/**
 * CLIENT ONLY — every request the browser makes to /api/notification lives here, so hooks and
 * components never spell out an endpoint or a request body. Paths come from contract.ts; the route
 * handlers that answer them are in app/api/notification.
 *
 * Two kinds of call:
 *   - ordinary awaited requests (axios) for things the UI reacts to: registering a device, marking read;
 *   - fire-and-forget `keepalive` requests for reports the page must not wait for and that may be sent
 *     while it is navigating away or closing: "the user clicked this notification", "this tab shows X".
 *     They are best-effort by design — if one is lost the server falls back to a safe default (the
 *     notification stays unread; the tab's entry expires on its own).
 */
import axios from 'axios';
import type { NotificationConfig } from '../config';
import { normalizeConfig } from '../configParse';
import {
    ACTIVE_CONTEXT_ENDPOINT,
    FCM_TOKEN_ENDPOINT,
    NOTIFICATION_CONFIG_ENDPOINT,
    NOTIFICATION_HANDLED_ENDPOINT,
    NOTIFICATION_READ_ENDPOINT,
    NOTIFICATION_SETTINGS_ENDPOINT,
} from '../contract';
import type { MarkReadInput } from '../schema';
import type { NotificationSettingsPatch } from '../settings';

function sendBeacon(url: string, body: unknown, method: 'POST' | 'PATCH' = 'POST'): void {
    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
    }).catch(() => {
        /* best-effort */
    });
}

/** Saves this browser's FCM token for the signed-in user (idempotent on the server). */
export function registerDevice(fcmToken: string, deviceType: string) {
    return axios.post(FCM_TOKEN_ENDPOINT, { fcmToken, deviceType });
}

/** Forgets this browser's FCM token for the signed-in user. */
export function unregisterDevice(fcmToken: string) {
    return axios.delete(FCM_TOKEN_ENDPOINT, { data: { fcmToken } });
}

/** Marks notifications as read: specific ids, or every unread one. */
export function markRead(body: MarkReadInput) {
    return axios.patch(NOTIFICATION_READ_ENDPOINT, body);
}

/** Saves a change to the notification settings (any subset of them). The server validates it. */
export function saveSettings(patch: NotificationSettingsPatch) {
    return axios.patch(NOTIFICATION_SETTINGS_ENDPOINT, patch);
}

/** Same, for a change still waiting when the page is closing: it must not be lost with the page. */
export function saveSettingsOnExit(patch: NotificationSettingsPatch): void {
    sendBeacon(NOTIFICATION_SETTINGS_ENDPOINT, patch, 'PATCH');
}

/**
 * The notification configuration every signed-in user works with. Whatever comes back is run through
 * parseConfig, so a response the app does not fully understand still yields a usable configuration.
 */
export async function fetchNotificationConfig(): Promise<NotificationConfig> {
    const { data } = await axios.get(NOTIFICATION_CONFIG_ENDPOINT);
    return normalizeConfig(data?.config);
}

/** The dashboard's read of the configuration: admins only (403 otherwise), never cached. `exists` is false while the built-in defaults are in force. */
export async function fetchNotificationConfigForEditing(): Promise<{ config: NotificationConfig; exists: boolean }> {
    const { data } = await axios.get(NOTIFICATION_CONFIG_ENDPOINT, { params: { manage: 1 } });
    return { config: normalizeConfig(data?.config), exists: data?.exists === true };
}

/** Saves the whole configuration (admins only). `expectedRevision` is the revision it was edited from; a stale one is answered with 409. Resolves to the configuration as stored. */
export async function saveNotificationConfigRequest(config: NotificationConfig, expectedRevision: number): Promise<NotificationConfig> {
    const { data } = await axios.put(NOTIFICATION_CONFIG_ENDPOINT, { config, expectedRevision });
    return normalizeConfig(data?.config);
}

/**
 * The user clicked the delivered notification `key` (NotificationPayload.key), so its stored copy is
 * deleted. If the request fails the notification simply stays in the list as unread — the safe outcome.
 */
export function markNotificationHandled(key: string): void {
    sendBeacon(NOTIFICATION_HANDLED_ENDPOINT, { key });
}

/** This tab (`sessionId`) shows `link` — or, with `null`, no longer shows anything. */
export function reportActiveContext(sessionId: string, link: string | null): void {
    sendBeacon(ACTIVE_CONTEXT_ENDPOINT, { sessionId, link });
}
