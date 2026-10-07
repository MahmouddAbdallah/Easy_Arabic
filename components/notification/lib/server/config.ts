/**
 * SERVER ONLY — uses firebase-admin (through ./firestore).
 *
 * Where the notification CONFIGURATION lives (shape and meaning: ../config.ts): one document,
 * `notificationConfig/main`. Two very different callers:
 *
 *   loadNotificationConfig()   the hot path — every sendNotification() and every settings change reads it. Each
 *                              instance remembers what it read for CONFIG_CACHE_MS, concurrent callers share one
 *                              read, and it NEVER throws: if Firestore is unreachable it returns the last
 *                              configuration it knew, or the built-in defaults. A notification must never fail
 *                              because the dashboard's document could not be read.
 *   readNotificationConfig()   the admin's view — always fresh, and it does throw (the dashboard shows the error).
 *   saveNotificationConfig()   the admin's write — a transaction that refuses to overwrite a configuration the
 *                              admin has not seen (the revision they edited must still be the current one).
 *
 * A change made on another instance reaches sends within CONFIG_CACHE_MS; on the instance that saved it, at once.
 * A missing or damaged document is not an error: it reads as the built-in defaults (configParse.ts repairs what it can).
 */
import { FieldValue, type DocumentSnapshot } from 'firebase-admin/firestore';
import { NOTIFICATION_CONFIG_COLLECTION, NOTIFICATION_CONFIG_DOC } from '../contract';
import { DEFAULT_NOTIFICATION_CONFIG, type NotificationConfig } from '../config';
import { parseConfig } from '../configParse';
import { firestore } from './firestore';

const CONFIG_CACHE_MS = 20_000;
/** After a failed read, how long to use what we have before trying Firestore again. */
const FAILURE_RETRY_MS = 5_000;

let cache: { config: NotificationConfig; until: number } | undefined;
let inflight: Promise<NotificationConfig> | undefined;

async function configRef() {
    return (await firestore()).collection(NOTIFICATION_CONFIG_COLLECTION).doc(NOTIFICATION_CONFIG_DOC);
}

/** Epoch milliseconds from whatever a Firestore timestamp field comes back as. */
function toMillis(value: unknown): number | null {
    const timestamp = value as { toMillis?: () => number } | null | undefined;
    return typeof timestamp?.toMillis === 'function' ? timestamp.toMillis() : null;
}

function fromSnapshot(snapshot: DocumentSnapshot): { config: NotificationConfig; exists: boolean } {
    if (!snapshot.exists) return { config: DEFAULT_NOTIFICATION_CONFIG, exists: false };
    const data = snapshot.data() ?? {};
    return { config: parseConfig({ ...data, updatedAt: toMillis(data.updatedAt) }).config, exists: true };
}

/** The configuration straight from Firestore, with `exists` telling "saved by an admin" from "built-in defaults". Throws if Firestore fails. */
export async function readNotificationConfig(): Promise<{ config: NotificationConfig; exists: boolean }> {
    const result = fromSnapshot(await (await configRef()).get());
    cache = { config: result.config, until: Date.now() + CONFIG_CACHE_MS };
    return result;
}

/** The configuration sends and settings changes work with. Cached; never throws. */
export function loadNotificationConfig(): Promise<NotificationConfig> {
    if (cache && Date.now() < cache.until) return Promise.resolve(cache.config);

    inflight ??= (async () => {
        try {
            return (await readNotificationConfig()).config;
        } catch (error) {
            console.error('[notification] Could not read the notification configuration, using the last known one:', error);
            const known = cache?.config ?? DEFAULT_NOTIFICATION_CONFIG;
            cache = { config: known, until: Date.now() + FAILURE_RETRY_MS };
            return known;
        } finally {
            inflight = undefined;
        }
    })();
    return inflight;
}

/** Someone else saved a configuration after the one being edited was loaded. */
export class ConfigConflictError extends Error {
    constructor(readonly currentRevision: number) {
        super('The notification configuration was changed by someone else.');
        this.name = 'ConfigConflictError';
    }
}

/**
 * Stores `config` (already validated by parseConfig) as revision `expectedRevision + 1` — but only if
 * `expectedRevision` is still the stored one (0 while nothing was ever saved); otherwise throws
 * ConfigConflictError and writes nothing. The whole document is replaced, so a section removed in the
 * dashboard is really gone. Returns the configuration as stored.
 */
export async function saveNotificationConfig(config: NotificationConfig, expectedRevision: number, adminId: string): Promise<NotificationConfig> {
    const ref = await configRef();
    const db = await firestore();

    // `revision` and `updatedAt` belong to the server: whatever the caller sent is replaced below.
    const { revision: _revision, updatedAt: _updatedAt, ...content } = config;
    void _revision;
    void _updatedAt;

    await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const stored = snapshot.data()?.revision;
        const current = snapshot.exists && typeof stored === 'number' && Number.isInteger(stored) && stored >= 0 ? stored : 0;
        if (current !== expectedRevision) throw new ConfigConflictError(current);

        transaction.set(ref, { ...content, revision: current + 1, updatedAt: FieldValue.serverTimestamp(), updatedBy: adminId });
    });

    cache = undefined;
    return (await readNotificationConfig()).config;
}
