/**
 * SERVER ONLY — uses firebase-admin (through ./firestore).
 *
 * What sendNotification() needs to know about each recipient before it sends: are they already looking
 * at the page the notification is about (./presence.ts), and what did they choose to be alerted about
 * (./settings.ts). Both live in Firestore, so they are fetched together — presence and settings of a user travel
 * in the same batched read — and choices this instance remembers are not fetched again. What they chose
 * is then resolved against the notification configuration (../config.ts): what a person never chose takes
 * the configured default, and locked controls take theirs.
 *
 * A big audience is read in slices (USERS_PER_READ users each, a few slices at a time) instead of with one enormous
 * request. The result is the same, but a slice that fails — a timeout, a transient backend error — only affects its own
 * users: they fall back to "not viewing, configured defaults" (or to the choices this instance remembers), while everyone
 * else keeps their real presence and settings. One bad request no longer turns a thousand people's mute switches off.
 */
import { chunk } from './chunk';
import { settleWithLimit } from './concurrency';
import { firestore } from './firestore';
import { isViewing, presenceRef } from './presence';
import { cachedChoices, rememberChoices, settingsRefOf } from './settings';
import type { NotificationConfig } from '../config';
import { normalizeSettings, type NotificationSettings, type NotificationSettingsPatch } from '../settings';

export interface RecipientState {
    /** A live, recently active tab of theirs shows the notification's link. */
    viewing: boolean;
    settings: NotificationSettings;
}

/** Users per batched read: at most two documents each (presence + settings), so 500 documents per request. */
const USERS_PER_READ = 250;

/** How many slices are read at the same time. */
const READ_CONCURRENCY = 4;

/**
 * The state of each of `userIds`, with their settings resolved under `config`. Presence is only looked up
 * when the notification has a `link`. Users whose documents could not be read get the configured defaults (and are
 * not treated as viewing) — a duplicate notification is better than a lost one. Throws only if Firestore itself
 * cannot be reached at all (sendNotification then sends anyway, with the defaults for everybody).
 */
export async function loadRecipientState(
    userIds: string[],
    link: string | undefined,
    config: NotificationConfig
): Promise<Map<string, RecipientState>> {
    const db = await firestore();
    const now = Date.now();

    // What each person chose, as far as this instance already knows (a person who chose nothing is remembered too).
    const chosen = new Map<string, NotificationSettingsPatch>();
    const needSettings = new Set<string>();
    for (const userId of userIds) {
        const remembered = cachedChoices(userId, now);
        if (remembered) chosen.set(userId, remembered);
        else needSettings.add(userId);
    }

    const viewing = new Set<string>();
    const unreadable = new Set<string>();

    // Presence is needed for everybody when there is a link; otherwise only the people whose settings are not remembered.
    const toRead = link ? userIds : userIds.filter((userId) => needSettings.has(userId));
    const slices = chunk(toRead, USERS_PER_READ);

    const outcomes = await settleWithLimit(slices, READ_CONCURRENCY, async (slice) => {
        const presence = link ? slice.map((userId) => presenceRef(db, userId)) : [];
        const settings = slice.filter((userId) => needSettings.has(userId)).map((userId) => settingsRefOf(db, userId));
        if (presence.length + settings.length === 0) return;

        const snapshots = await db.getAll(...presence, ...settings);
        snapshots.slice(0, presence.length).forEach((snapshot) => {
            if (link && isViewing(snapshot, link, now)) viewing.add(snapshot.id);
        });
        snapshots.slice(presence.length).forEach((snapshot) => {
            chosen.set(snapshot.id, rememberChoices(snapshot, now));
        });
    });

    let firstError: unknown;
    outcomes.forEach((outcome, index) => {
        if (outcome.status === 'fulfilled') return;
        firstError ??= outcome.reason;
        slices[index].forEach((userId) => unreadable.add(userId));
    });
    if (unreadable.size > 0) {
        console.error(
            `[notification] Could not read the presence and settings of ${unreadable.size} of ${userIds.length} recipients; ` +
                'they are treated as not viewing, with the choices this instance remembers or the configured defaults:',
            firstError
        );
    }

    // Most people never opened the settings screen: they all resolve to the same defaults, so resolve them once.
    const defaults = normalizeSettings({}, config);
    return new Map(
        userIds.map((userId) => {
            const stored = chosen.get(userId);
            const settings = stored && Object.keys(stored).length > 0 ? normalizeSettings(stored, config) : defaults;
            return [userId, { viewing: viewing.has(userId), settings }] as const;
        })
    );
}
