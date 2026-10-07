/**
 * SERVER ONLY — uses firebase-admin (through ./firestore).
 *
 * What sendNotification() needs to know about each recipient before it sends: are they already looking
 * at the page the notification is about (./presence.ts), and what did they choose to be alerted about
 * (./settings.ts). Both live in Firestore, so they are fetched with ONE batched read — one round trip
 * for any number of recipients — and choices this instance remembers are not fetched again. What they chose
 * is then resolved against the notification configuration (../config.ts): what a person never chose takes
 * the configured default, and locked controls take theirs.
 */
import { firestore } from './firestore';
import { isViewing, presenceRef } from './presence';
import { cachedChoices, rememberChoices, settingsRef } from './settings';
import type { NotificationConfig } from '../config';
import { normalizeSettings, type NotificationSettings, type NotificationSettingsPatch } from '../settings';

export interface RecipientState {
    /** A live, recently active tab of theirs shows the notification's link. */
    viewing: boolean;
    settings: NotificationSettings;
}

/**
 * The state of each of `userIds`, with their settings resolved under `config`. Presence is only looked up
 * when the notification has a `link`. Throws if Firestore fails — the caller decides what to do
 * (sendNotification sends anyway, with the configured defaults).
 */
export async function loadRecipientState(
    userIds: string[],
    link: string | undefined,
    config: NotificationConfig
): Promise<Map<string, RecipientState>> {
    const db = await firestore();
    const now = Date.now();

    const remembered = new Map<string, NotificationSettingsPatch | undefined>(userIds.map((userId) => [userId, cachedChoices(userId, now)] as const));
    const missing = userIds.filter((userId) => !remembered.get(userId));

    const presenceUsers = link ? userIds : [];
    const refs = [
        ...presenceUsers.map((userId) => presenceRef(db, userId)),
        ...(await Promise.all(missing.map((userId) => settingsRef(userId)))),
    ];
    const snapshots = refs.length > 0 ? await db.getAll(...refs) : [];

    const viewing = new Set<string>();
    snapshots.slice(0, presenceUsers.length).forEach((snapshot) => {
        if (link && isViewing(snapshot, link, now)) viewing.add(snapshot.id);
    });
    snapshots.slice(presenceUsers.length).forEach((snapshot) => {
        remembered.set(snapshot.id, rememberChoices(snapshot, now));
    });

    return new Map(
        userIds.map(
            (userId) => [userId, { viewing: viewing.has(userId), settings: normalizeSettings(remembered.get(userId) ?? {}, config) }] as const
        )
    );
}
