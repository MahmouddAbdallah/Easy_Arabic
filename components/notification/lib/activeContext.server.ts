/**
 * SERVER ONLY — uses firebase-admin. Never import this from a client component.
 *
 * Where each user is looking right now, so that sendNotification() can skip a notification about
 * the page the user is already on (see contract.ts: "What the user is looking at right now").
 *
 *   activeNotificationContext (collection)
 *     └── {userId} (document)  ->  { sessions: { [sessionId]: { link, expiresAt } } }
 *
 * One entry per visible browser tab. Entries are only trusted until `expiresAt`: a tab keeps its
 * entry alive with heartbeats, so a tab that vanished without saying goodbye stops counting within
 * ACTIVE_CONTEXT_TTL_MS. Every write also drops the entries that already expired, and a user with
 * no live tab has no document at all.
 *
 * Nothing here is readable by the browser — it only ever writes through POST /api/notification/context.
 */
import { ACTIVE_CONTEXT_TTL_MS } from './contract';
import { firestore } from './firestore.server';

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

    await db.runTransaction(async (tx) => {
        const now = Date.now();
        const sessions = liveSessions((await tx.get(ref)).get('sessions'), now);

        if (link) sessions[sessionId] = { link: canonicalLocation(link), expiresAt: now + ACTIVE_CONTEXT_TTL_MS };
        else delete sessions[sessionId];

        if (Object.keys(sessions).length > 0) tx.set(ref, { sessions });
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
