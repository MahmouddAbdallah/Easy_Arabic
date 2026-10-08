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
 *
 * What is remembered is what the person CHOSE (a sparse patch, see ../settings.ts), not the resolved settings:
 * resolving them against the notification configuration (../config.ts) happens at the moment of use, so a
 * configuration change applies to the very next send instead of waiting for this cache to expire.
 */
import { FieldValue, type DocumentSnapshot, type Firestore } from 'firebase-admin/firestore';
import { NOTIFICATION_SETTINGS_COLLECTION } from '../contract';
import { pickStoredSettings, type NotificationSettingsPatch } from '../settings';
import { firestore } from './firestore';

const SETTINGS_CACHE_MS = 20_000;
const SETTINGS_CACHE_MAX = 5_000;

const cache = new Map<string, { stored: NotificationSettingsPatch; at: number }>();

/** The settings document of `userId`, for a caller that already holds the database (no async hop per user when reading many). */
export function settingsRefOf(db: Firestore, userId: string) {
    return db.collection(NOTIFICATION_SETTINGS_COLLECTION).doc(userId);
}

export async function settingsRef(userId: string) {
    return settingsRefOf(await firestore(), userId);
}

/** What this instance remembers `userId` chose, if it is still fresh. */
export function cachedChoices(userId: string, now = Date.now()): NotificationSettingsPatch | undefined {
    const entry = cache.get(userId);
    return entry && now - entry.at < SETTINGS_CACHE_MS ? entry.stored : undefined;
}

/** Keeps the valid choices of a freshly read settings document and remembers them. A missing document means "chose nothing". */
export function rememberChoices(snapshot: DocumentSnapshot, now = Date.now()): NotificationSettingsPatch {
    const stored = pickStoredSettings(snapshot.data());

    if (cache.size >= SETTINGS_CACHE_MAX) cache.delete(cache.keys().next().value as string); // oldest first
    cache.set(snapshot.id, { stored, at: now });
    return stored;
}

/** Applies `patch` to the user's settings (creating the document on first use). Throws if the write fails. */
export async function saveSettings(userId: string, patch: NotificationSettingsPatch): Promise<void> {
    const ref = await settingsRef(userId);
    // A merge write changes only the fields in the patch, nested groups included.
    await ref.set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    cache.delete(userId);
}
