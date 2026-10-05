/**
 * CLIENT ONLY — the Firebase web SDK. Never import this from server code.
 *
 * The signed-in user's in-app notifications (Firestore collection `Notification`), newest first, held in ONE
 * place for the whole app. The bell's list, the full page and the live alerts all read from it, so there is
 * a single Firestore listener however many of them are mounted — and opening or closing the popover costs
 * no reads at all.
 *
 * The listener watches the newest LIVE_WINDOW notifications:
 *  - new arrivals, updates to a notification that was sent again, read-state changes and deletions (a clicked
 *    notification is deleted) show up instantly;
 *  - notifications that slide out of the window as newer ones arrive stay in the list;
 *  - "load more" fetches the next older page once, with a cursor (no listener per page).
 *
 * The listener runs while something holds the store (`retain`) and for GRACE_MS after the last holder lets go,
 * so closing and reopening the popover does not tear it down and read the window again.
 *
 * It also tells subscribers about ARRIVALS — an unread notification that is new or was sent again since the
 * listener started — which is what drives pop-ups and sound (lib/client/alerts.ts). The first snapshot is
 * history, not news, and is never reported.
 *
 * It is a plain external store (subscribe / getSnapshot) so React reads it with useSyncExternalStore.
 */
import {
    collection,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    startAfter,
    where,
    type DocumentChange,
    type Query,
    type QueryDocumentSnapshot,
    type QuerySnapshot,
    type Unsubscribe,
} from 'firebase/firestore';
import { firebaseClientDB } from '@/lib/config/firebase-client';
import { NOTIFICATION_COLLECTION, NOTIFICATION_TYPES, isSafeInternalLink, type InAppNotification } from '../contract';

/** How many of the newest notifications the live listener watches. */
export const LIVE_WINDOW = 20;

/** How long the listener outlives its last holder. */
export const GRACE_MS = 60_000;

export interface InboxSnapshot {
    /** Whose notifications these are (a stale snapshot of a previous user is never shown to the next one). */
    userId: string | undefined;
    status: 'idle' | 'loading' | 'ready' | 'error';
    /** Newest first. */
    notifications: InAppNotification[];
    /** Are there older notifications than the ones loaded? */
    hasMore: boolean;
    loadingMore: boolean;
}

const IDLE: InboxSnapshot = { userId: undefined, status: 'idle', notifications: [], hasMore: false, loadingMore: false };

/** Stored documents are data from outside the component — only render what is valid. */
export function toNotification(doc: QueryDocumentSnapshot): InAppNotification {
    const data = doc.data();
    return {
        id: doc.id,
        type: NOTIFICATION_TYPES.find((type) => type === data.type) ?? 'general',
        title: typeof data.title === 'string' ? data.title : '',
        body: typeof data.body === 'string' ? data.body : '',
        link: isSafeInternalLink(data.link) ? data.link : undefined,
        isRead: data.isRead === true,
        createdAt: data.createdAt?.toMillis?.() ?? 0,
        count: typeof data.count === 'number' && data.count >= 1 ? Math.floor(data.count) : 1,
        key: typeof data.key === 'string' && /^[a-f0-9]{64}$/.test(data.key) ? data.key : undefined,
        sendId: typeof data.sendId === 'string' ? data.sendId : undefined,
    };
}

/**
 * A "removed" change in the live window means one of two things: the notification was deleted (the user
 * clicked it — see contract.ts), or newer ones pushed it out of the window while it still exists. Only
 * the first must disappear from the list.
 *
 * A window that is not full cannot have pushed anything out, so the notification was deleted. In a full
 * window, a pushed-out notification is older than everything left in it (the window holds the newest
 * ones), whereas a deleted one is newer than the older notification that slid in to take its place.
 */
function wasDeleted(change: DocumentChange, snapshot: QuerySnapshot): boolean {
    const oldestShown = snapshot.docs.at(-1);
    if (snapshot.size < LIVE_WINDOW || !oldestShown) return true;
    return toNotification(change.doc).createdAt > toNotification(oldestShown).createdAt;
}

type Listener = () => void;
type ArrivalListener = (notification: InAppNotification) => void;

export class InboxStore {
    private userId: string | undefined;
    private status: InboxSnapshot['status'] = 'idle';
    private byId: Record<string, InAppNotification> = {};
    private hasMore = false;
    private loadingMore = false;
    private snapshot: InboxSnapshot = IDLE;

    private listeners = new Set<Listener>();
    private arrivalListeners = new Set<ArrivalListener>();

    private holders = 0;
    private unsubscribe: Unsubscribe | undefined;
    private teardown: ReturnType<typeof setTimeout> | undefined;

    /** The query "load more" continues. */
    private newestFirst: Query | undefined;
    /** Last loaded document: the page "load more" continues after. */
    private cursor: QueryDocumentSnapshot | null = null;
    /** Once an older page was loaded, the live window no longer decides the cursor / hasMore. */
    private paged = false;
    /** Newest `createdAt` seen so far: only something newer than this is an arrival. */
    private watermark = 0;
    private firstSnapshot = true;

    // ── React side (useSyncExternalStore) ─────────────────────────────────────

    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    getSnapshot = (): InboxSnapshot => this.snapshot;

    getServerSnapshot = (): InboxSnapshot => IDLE;

    /** `listener` is called for every unread notification that arrives (or is sent again) after the listener started. */
    onArrival(listener: ArrivalListener): () => void {
        this.arrivalListeners.add(listener);
        return () => this.arrivalListeners.delete(listener);
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /** Keeps the listener running for `userId` until the returned function is called. */
    retain(userId: string): () => void {
        this.holders += 1;
        clearTimeout(this.teardown);

        if (this.userId !== userId) this.stop(); // a different user: start from scratch
        this.userId = userId;
        if (!this.unsubscribe) this.start(userId);

        let released = false;
        return () => {
            if (released) return;
            released = true;
            this.holders -= 1;
            if (this.holders === 0) this.teardown = setTimeout(() => this.stop(), GRACE_MS);
        };
    }

    /** Stops listening and forgets everything now (sign-out): nothing of this user may linger in memory. */
    dispose(): void {
        clearTimeout(this.teardown);
        this.stop();
        this.userId = undefined;
        this.publish();
    }

    private start(userId: string) {
        this.firstSnapshot = true;
        this.watermark = 0;
        this.paged = false;
        this.cursor = null;
        this.byId = {};
        this.hasMore = false;
        this.status = 'loading';

        this.newestFirst = query(
            collection(firebaseClientDB, NOTIFICATION_COLLECTION),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );
        this.publish();

        this.unsubscribe = onSnapshot(
            query(this.newestFirst, limit(LIVE_WINDOW)),
            (snapshot) => this.onWindow(userId, snapshot),
            (error) => {
                // A missing composite index is reported here, with a link that creates it.
                console.error('[notification] Could not listen to notifications:', error);
                if (this.userId !== userId) return;
                this.status = 'error';
                this.publish();
            }
        );
    }

    private stop() {
        clearTimeout(this.teardown);
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.newestFirst = undefined;
        this.cursor = null;
        this.byId = {};
        this.hasMore = false;
        this.loadingMore = false;
        this.status = 'idle';
        this.publish();
    }

    // ── Incoming data ─────────────────────────────────────────────────────────

    private onWindow(userId: string, snapshot: QuerySnapshot) {
        if (this.userId !== userId) return; // a late callback of a listener that has been replaced

        // Additions and edits are applied. "Removed" is applied only for deletions — a notification
        // pushed out of the window by a newer one still exists and stays in the list.
        const changes = snapshot.docChanges();
        const changed = changes.filter((change) => change.type !== 'removed').map((change) => toNotification(change.doc));
        const deleted = changes.filter((change) => change.type === 'removed' && wasDeleted(change, snapshot));

        const arrivals = this.firstSnapshot
            ? []
            : changed.filter((n) => !n.isRead && n.createdAt > this.watermark).sort((a, b) => a.createdAt - b.createdAt);
        this.watermark = Math.max(this.watermark, ...changed.map((n) => n.createdAt));
        this.firstSnapshot = false;

        const next = { ...this.byId };
        for (const n of changed) next[n.id] = n;
        for (const change of deleted) delete next[change.doc.id];
        this.byId = next;

        if (!this.paged) {
            this.cursor = snapshot.docs.at(-1) ?? null;
            this.hasMore = snapshot.size >= LIVE_WINDOW;
        }
        this.status = 'ready';
        this.publish();

        for (const arrival of arrivals) this.arrivalListeners.forEach((listener) => listener(arrival));
    }

    // ── Actions ───────────────────────────────────────────────────────────────

    /** Fetches the next `count` older notifications (once; no listener). Throws if the request fails. */
    async loadMore(count: number): Promise<void> {
        const after = this.cursor;
        const base = this.newestFirst;
        const userId = this.userId;
        if (!base || !after || this.loadingMore) return;

        this.loadingMore = true;
        this.publish();
        try {
            const page = await getDocs(query(base, startAfter(after), limit(Math.max(1, count))));
            if (this.userId !== userId) return;

            this.paged = true;
            this.cursor = page.docs.at(-1) ?? after;
            this.hasMore = page.size >= count;
            const next = { ...this.byId };
            for (const doc of page.docs) next[doc.id] = toNotification(doc);
            this.byId = next;
        } finally {
            this.loadingMore = false;
            this.publish();
        }
    }

    /** Applies a read/unread change locally (optimistic — the caller reverts it if the server refuses). */
    setRead(ids: string[], isRead: boolean): void {
        const next = { ...this.byId };
        for (const id of ids) if (next[id]) next[id] = { ...next[id], isRead };
        this.byId = next;
        this.publish();
    }

    // ── Publishing ────────────────────────────────────────────────────────────

    private publish() {
        this.snapshot = {
            userId: this.userId,
            status: this.status,
            notifications: Object.values(this.byId).sort((a, b) => b.createdAt - a.createdAt),
            hasMore: this.hasMore,
            loadingMore: this.loadingMore,
        };
        this.listeners.forEach((listener) => listener());
    }
}

/** The one store of the app. */
export const inboxStore = new InboxStore();
