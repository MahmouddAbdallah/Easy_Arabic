/**
 * SERVER ONLY — uses firebase-admin (through ./firestore).
 *
 * The write side of a user's notification settings (shape and meaning: ../settings.ts, document
 * `notificationSettings/{userId}`). The browser reads the document live and never writes it; changes
 * arrive through PATCH /api/notification/settings. sendNotification() reads it through ./recipients.ts.
 *
 * Reads are the hot path — every send looks at its recipients' settings — so each instance remembers what it
 * read for SETTINGS_CACHE_MS. A change made on another instance therefore takes at most that long to reach
 * pushes; on the instance that saved it, it applies at once. (The person's own screens update instantly
 * either way: they listen to the document.)
 */
import { FieldValue, type DocumentSnapshot } from 'firebase-admin/firestore';
import { NOTIFICATION_SETTINGS_COLLECTION } from '../contract';
import { normalizeSettings, type NotificationSettings, type NotificationSettingsPatch } from '../settings';
import { firestore } from './firestore';

const SETTINGS_CACHE_MS = 20_000;
const SETTINGS_CACHE_MAX = 5_000;

const cache = new Map<string, { settings: NotificationSettings; at: number }>();

export async function settingsRef(userId: string) {
    return (await firestore()).collection(NOTIFICATION_SETTINGS_COLLECTION).doc(userId);
}

/** What this instance remembers about `userId`'s settings, if it is still fresh. */
export function cachedSettings(userId: string, now = Date.now()): NotificationSettings | undefined {
    const entry = cache.get(userId);
    return entry && now - entry.at < SETTINGS_CACHE_MS ? entry.settings : undefined;
}

/** Normalises a freshly read settings document and remembers it. A missing document means "all defaults". */
export function rememberSettings(snapshot: DocumentSnapshot, now = Date.now()): NotificationSettings {
    const settings = normalizeSettings(snapshot.data());

    if (cache.size >= SETTINGS_CACHE_MAX) cache.delete(cache.keys().next().value as string); // oldest first
    cache.set(snapshot.id, { settings, at: now });
    return settings;
}

/** Applies `patch` to the user's settings (creating the document on first use). Throws if the write fails. */
export async function saveSettings(userId: string, patch: NotificationSettingsPatch): Promise<void> {
    const ref = await settingsRef(userId);
    // A merge write changes only the fields in the patch, nested groups included.
    await ref.set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    cache.delete(userId);
}
