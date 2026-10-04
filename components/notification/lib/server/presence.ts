/**
 * SERVER ONLY — uses firebase-admin (through ./firestore).
 *
 * Where each user is looking right now, so that sendNotification() can skip a notification about
 * the page the user is already on (see contract.ts: "What the user is looking at right now").
 *
 *   activeNotificationContext (collection)
 *     └── {userId} (document)  ->  { sessions: { [sessionId]: { link, expiresAt } } }
 *
 * One entry per visible browser tab. Entries are only trusted until `expiresAt`: a tab keeps its
 * entry alive with heartbeats, so a tab that vanished without saying goodbye stops counting within
 * ACTIVE_CONTEXT_TTL_MS (readers ignore expired entries, so nothing has to delete them on time).
 *
 * The two write paths are shaped by how often they run:
 *   - "this tab shows `link`" — every heartbeat and every navigation, by far the most frequent — is ONE
 *     blind merge write of the tab's own entry: no read, no transaction, no lock, and tabs of the same
 *     user never wait for each other.
 *   - "this tab is gone" — a tab hiding or closing, rare — is a transaction: it removes the entry and
 *     sweeps the entries that already expired (those of tabs that crashed or lost their connection),
 *     which keeps a user's document small. A user with no live tab has no document at all.
 *
 * Nothing here is readable by the browser — it only ever writes through POST /api/notification/context.
 */
import { ACTIVE_CONTEXT_TTL_MS } from '../contract';
import { firestore } from './firestore';

const ACTIVE_CONTEXT_COLLECTION = 'activeNotificationContext';

interface Session {
    link: string;
    /** Epoch milliseconds. */
    expiresAt: number;
}

type Sessions = Record<string, Session>;

/**
 * Two links are the same place when they have the same path and the same query parameters:
 * "/chat/?b=2&a=1#top" and "/chat?a=1&b=2" match, "/chat?receiverId=1" and "/chat?receiverId=2"
 * (or plain "/chat") do not.
 */
function canonicalLocation(location: string): string {
    const url = new URL(location, 'http://localhost'); // the base only lets relative paths parse
    url.searchParams.sort();
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
    return `${path}${url.search}`;
}

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

/**
 * Records that tab `sessionId` of `userId` is showing `link` (renewing its expiry), or — with
 * `null` — that it no longer is.
 */
export async function setActiveContext(userId: string, sessionId: string, link: string | null): Promise<void> {
    const db = await firestore();
    const ref = db.collection(ACTIVE_CONTEXT_COLLECTION).doc(userId);

    if (link) {
        const session: Session = { link: canonicalLocation(link), expiresAt: Date.now() + ACTIVE_CONTEXT_TTL_MS };
        // Merging a nested map writes only this tab's entry and leaves the user's other tabs untouched.
        await ref.set({ sessions: { [sessionId]: session } }, { merge: true });
        return;
    }

    await db.runTransaction(async (tx) => {
        const stored: unknown = (await tx.get(ref)).get('sessions');
        const remaining = liveSessions(stored, Date.now());
        delete remaining[sessionId];

        // Nothing to remove and nothing expired to sweep: leave the document alone (no write at all).
        const storedCount = typeof stored === 'object' && stored !== null ? Object.keys(stored).length : 0;
        if (Object.keys(remaining).length === storedCount) return;

        if (Object.keys(remaining).length > 0) tx.set(ref, { sessions: remaining });
        else tx.delete(ref);
    });
}

/** The users among `userIds` who have a visible tab showing `link` right now. */
export async function usersViewing(userIds: string[], link: string): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();

    const db = await firestore();
    const target = canonicalLocation(link);
    const now = Date.now();
    const snapshots = await db.getAll(...userIds.map((userId) => db.collection(ACTIVE_CONTEXT_COLLECTION).doc(userId)));

    return new Set(
        snapshots
            .filter((snapshot) => Object.values(liveSessions(snapshot.get('sessions'), now)).some((s) => s.link === target))
            .map((snapshot) => snapshot.id)
    );
}
