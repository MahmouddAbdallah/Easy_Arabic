/**
 * SERVER ONLY — uses firebase-admin (through ./firestore).
 *
 * Where each user is looking right now, so that sendNotification() can skip a notification about
 * the page the user is already on (see contract.ts: "What the user is looking at right now").
 *
 *   activeNotificationContext (collection)
 *     └── {userId} (document)  ->  { sessions: { [sessionId]: { link, expiresAt } }, expireAt }
 *
 * One entry per visible browser tab. Entries are only trusted until `expiresAt`: the tab renews its entry
 * while the person interacts, and one that stops (idle, crashed, offline) lapses on its own after
 * ACTIVE_CONTEXT_TTL_MS — readers ignore expired entries, so nothing has to delete them on time.
 * `expireAt` (a Firestore Timestamp, the latest `expiresAt` of the document) exists so a TTL policy on that
 * field can remove the documents of users who vanished without a goodbye; it is optional housekeeping.
 *
 * The two write paths are shaped by how often they run:
 *   - "this tab shows `link`" — a page change or a renewal, by far the most frequent — is ONE blind merge
 *     write of the tab's own entry: no read, no transaction, no lock, and tabs of the same user never
 *     wait for each other.
 *   - "this tab is gone" — a tab hiding or closing, rare — is a transaction: it removes the entry and
 *     sweeps the entries that already expired (those of tabs that crashed or lost their connection),
 *     which keeps a user's document small. A user with no live tab has no document at all.
 *
 * Nothing here is readable by the browser — it only ever writes through POST /api/notification/context.
 * Reading happens in recipients.ts, batched with the recipients' settings.
 */
import type { DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import { ACTIVE_CONTEXT_TTL_MS } from '../contract';
import { canonicalLocation } from '../location';
import { firestore } from './firestore';

const ACTIVE_CONTEXT_COLLECTION = 'activeNotificationContext';

interface Session {
    link: string;
    /** Epoch milliseconds. */
    expiresAt: number;
}

type Sessions = Record<string, Session>;

/** The entries of a stored `sessions` map that have not expired yet (tolerant of anything malformed). */
function liveSessions(stored: unknown, now: number): Sessions {
    if (typeof stored !== 'object' || stored === null) return {};

    return Object.fromEntries(
        Object.entries(stored as Record<string, Partial<Session> | null>).filter(
            (entry): entry is [string, Session] =>
                typeof entry[1]?.link === 'string' && typeof entry[1].expiresAt === 'number' && entry[1].expiresAt > now
        )
    );
}

export function presenceRef(db: Firestore, userId: string) {
    return db.collection(ACTIVE_CONTEXT_COLLECTION).doc(userId);
}

/**
 * Records that tab `sessionId` of `userId` is showing `link` (renewing its expiry), or — with
 * `null` — that it no longer is.
 */
export async function setActiveContext(userId: string, sessionId: string, link: string | null): Promise<void> {
    const db = await firestore();
    const ref = presenceRef(db, userId);

    if (link) {
        const expiresAt = Date.now() + ACTIVE_CONTEXT_TTL_MS;
        // Merging a nested map writes only this tab's entry and leaves the user's other tabs untouched.
        // `expireAt` is the time of the newest write plus the TTL, so it is never earlier than any entry's expiry.
        await ref.set(
            { sessions: { [sessionId]: { link: canonicalLocation(link), expiresAt } }, expireAt: new Date(expiresAt) },
            { merge: true }
        );
        return;
    }

    await db.runTransaction(async (tx) => {
        const stored: unknown = (await tx.get(ref)).get('sessions');
        const remaining = liveSessions(stored, Date.now());
        delete remaining[sessionId];

        // Nothing to remove and nothing expired to sweep: leave the document alone (no write at all).
        const storedCount = typeof stored === 'object' && stored !== null ? Object.keys(stored).length : 0;
        if (Object.keys(remaining).length === storedCount) return;

        const latest = Math.max(0, ...Object.values(remaining).map((s) => s.expiresAt));
        if (latest > 0) tx.set(ref, { sessions: remaining, expireAt: new Date(latest) });
        else tx.delete(ref);
    });
}

/** Does this user's presence document show a live tab on `link`? (`snapshot` may be of a missing document.) */
export function isViewing(snapshot: DocumentSnapshot, link: string, now: number = Date.now()): boolean {
    const target = canonicalLocation(link);
    return Object.values(liveSessions(snapshot.get('sessions'), now)).some((session) => session.link === target);
}
