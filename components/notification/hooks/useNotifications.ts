'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
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
    type QueryDocumentSnapshot,
    type QuerySnapshot,
} from 'firebase/firestore';
import { firebaseClientDB } from '@/lib/config/firebase-client';
import { markRead } from '../lib/client/api';
import {
    NOTIFICATION_COLLECTION,
    NOTIFICATION_TYPES,
    isSafeInternalLink,
    type InAppNotification,
} from '../lib/contract';
import type { MarkReadInput } from '../lib/schema';

export const DEFAULT_PAGE_SIZE = 20;

/** Stored documents are data from outside the component — only render what is valid. */
function toNotification(doc: QueryDocumentSnapshot): InAppNotification {
    const data = doc.data();
    return {
        id: doc.id,
        type: NOTIFICATION_TYPES.find((type) => type === data.type) ?? 'general',
        title: typeof data.title === 'string' ? data.title : '',
        body: typeof data.body === 'string' ? data.body : '',
        link: isSafeInternalLink(data.link) ? data.link : undefined,
        isRead: data.isRead === true,
        createdAt: data.createdAt?.toMillis?.() ?? 0,
    };
}

type NotificationsById = Record<string, InAppNotification>;

function upsert(current: NotificationsById, items: InAppNotification[]): NotificationsById {
    const next = { ...current };
    for (const item of items) next[item.id] = item;
    return next;
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
function wasDeleted(change: DocumentChange, snapshot: QuerySnapshot, pageSize: number): boolean {
    const oldestShown = snapshot.docs.at(-1);
    if (snapshot.size < pageSize || !oldestShown) return true;
    return toNotification(change.doc).createdAt > toNotification(oldestShown).createdAt;
}

/**
 * The signed-in user's in-app notifications (Firestore collection `Notification`), newest first.
 * Reads Firestore only — it does not depend on push permission or on NotificationProvider.
 *
 * Reads are kept to what is needed:
 *  - ONE real-time listener on the newest `pageSize` notifications: new arrivals, updates to a
 *    notification that was sent again, read-state changes and deletions (a clicked notification is
 *    deleted) show up instantly, and nothing is re-read when the user pages.
 *  - "Load more" fetches the next older page once, with a cursor (no listener per page).
 *  - Notifications that slide out of the live window as new ones arrive stay in the list.
 *
 * Changes (mark as read) go through the API and are applied optimistically.
 */
export function useNotifications(userId: string | undefined, pageSize = DEFAULT_PAGE_SIZE) {
    const [byId, setById] = useState<NotificationsById>({});
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    /** Last loaded document of the page "Load more" continues after. */
    const cursor = useRef<QueryDocumentSnapshot | null>(null);
    /** Once an older page was loaded, the live window no longer decides the cursor / hasMore. */
    const paged = useRef(false);

    const newestFirst = useMemo(
        () =>
            userId
                ? query(
                      collection(firebaseClientDB, NOTIFICATION_COLLECTION),
                      where('userId', '==', userId),
                      orderBy('createdAt', 'desc')
                  )
                : null,
        [userId]
    );

    useEffect(() => {
        if (!newestFirst) return;
        cursor.current = null;
        paged.current = false;

        const unsubscribe = onSnapshot(
            query(newestFirst, limit(pageSize)),
            (snapshot) => {
                // Additions and edits are applied. "Removed" is applied only for deletions — a notification
                // pushed out of the window by a newer one still exists and stays in the list.
                const changes = snapshot.docChanges();
                const changed = changes.filter((change) => change.type !== 'removed').map((change) => toNotification(change.doc));
                const deleted = changes.filter((change) => change.type === 'removed' && wasDeleted(change, snapshot, pageSize));
                setById((current) => {
                    const next = upsert(current, changed);
                    for (const change of deleted) delete next[change.doc.id];
                    return next;
                });

                if (!paged.current) {
                    cursor.current = snapshot.docs.at(-1) ?? null;
                    setHasMore(snapshot.size >= pageSize);
                }
                setStatus('ready');
            },
            (error) => {
                // A missing composite index is reported here, with a link that creates it.
                console.error('[notification] Could not listen to notifications:', error);
                setStatus('error');
            }
        );

        return () => {
            unsubscribe();
            setById({});
            setHasMore(false);
            setStatus('loading');
        };
    }, [newestFirst, pageSize]);

    const loadMore = useCallback(async () => {
        const after = cursor.current;
        if (!newestFirst || !after || loadingMore) return;

        setLoadingMore(true);
        try {
            const page = await getDocs(query(newestFirst, startAfter(after), limit(pageSize)));
            paged.current = true;
            cursor.current = page.docs.at(-1) ?? after;
            setHasMore(page.size >= pageSize);
            setById((current) => upsert(current, page.docs.map(toNotification)));
        } catch (error) {
            console.error('[notification] Could not load more notifications:', error);
            toast.error('Could not load more notifications. Please try again.');
        } finally {
            setLoadingMore(false);
        }
    }, [newestFirst, pageSize, loadingMore]);

    const notifications = useMemo(
        () => Object.values(byId).sort((a, b) => b.createdAt - a.createdAt),
        [byId]
    );
    const hasUnread = notifications.some((n) => !n.isRead);

    const setRead = useCallback((ids: string[], isRead: boolean) => {
        setById((current) => {
            const next = { ...current };
            for (const id of ids) if (next[id]) next[id] = { ...next[id], isRead };
            return next;
        });
    }, []);

    /** Optimistic: the UI updates at once and is put back if the server refuses. */
    const updateReadState = useCallback(
        async (body: MarkReadInput, ids: string[]) => {
            setRead(ids, true);
            try {
                await markRead(body);
            } catch (error) {
                console.error('[notification] Could not mark notifications as read:', error);
                setRead(ids, false);
                toast.error('Could not update your notifications. Please try again.');
            }
        },
        [setRead]
    );

    const markAsRead = useCallback((id: string) => updateReadState({ ids: [id] }, [id]), [updateReadState]);

    /** Marks every unread notification as read — including older ones that are not loaded yet. */
    const markAllAsRead = useCallback(
        () =>
            updateReadState(
                { all: true },
                notifications.filter((n) => !n.isRead).map((n) => n.id)
            ),
        [notifications, updateReadState]
    );

    return {
        notifications,
        // Signed out: there is nothing to load.
        status: userId ? status : 'ready',
        hasUnread,
        hasMore,
        loadingMore,
        loadMore,
        markAsRead,
        markAllAsRead,
    } as const;
}
