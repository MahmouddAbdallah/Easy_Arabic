'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { toast } from 'react-hot-toast';
import { markRead } from '../lib/client/api';
import { inboxStore } from '../lib/client/inboxStore';
import type { MarkReadInput } from '../lib/schema';

export const DEFAULT_PAGE_SIZE = 20;

/**
 * The signed-in user's in-app notifications, newest first. Reads Firestore only (through the shared
 * inbox store) — it does not depend on push permission or on NotificationProvider.
 *
 * Every component that calls this shares ONE Firestore listener, and the listener outlives a closing popover
 * for a minute, so opening and closing the bell costs no reads. `pageSize` is how many rows are shown at
 * first and added on each "Load more"; rows already in memory are revealed first and older ones are fetched
 * (once, with a cursor) only when they run out.
 *
 * Changes (mark as read) go through the API and are applied optimistically.
 */
export function useNotifications(userId: string | undefined, pageSize = DEFAULT_PAGE_SIZE) {
    const inbox = useSyncExternalStore(inboxStore.subscribe, inboxStore.getSnapshot, inboxStore.getServerSnapshot);
    const [shown, setShown] = useState(pageSize);

    useEffect(() => {
        if (!userId) return;
        return inboxStore.retain(userId);
    }, [userId]);

    // The store may still hold another user's data for a moment after an account switch: never show it.
    const mine = userId !== undefined && inbox.userId === userId;
    const all = useMemo(() => (mine ? inbox.notifications : []), [mine, inbox.notifications]);
    const loaded = mine ? inbox.status : 'loading';

    const notifications = useMemo(() => all.slice(0, shown), [all, shown]);
    const hasUnread = all.some((n) => !n.isRead);
    const hasMore = all.length > shown || (mine && inbox.hasMore);

    const [loadingMore, setLoadingMore] = useState(false);
    const loadMore = useCallback(async () => {
        const target = shown + pageSize;
        if (all.length < target && inbox.hasMore) {
            setLoadingMore(true);
            try {
                await inboxStore.loadMore(target - all.length);
            } catch (error) {
                console.error('[notification] Could not load more notifications:', error);
                toast.error('Could not load more notifications. Please try again.');
                return;
            } finally {
                setLoadingMore(false);
            }
        }
        setShown(target);
    }, [all.length, inbox.hasMore, pageSize, shown]);

    /** Optimistic: the UI updates at once and is put back if the server refuses. */
    const updateReadState = useCallback(async (body: MarkReadInput, ids: string[]) => {
        inboxStore.setRead(ids, true);
        try {
            await markRead(body);
        } catch (error) {
            console.error('[notification] Could not mark notifications as read:', error);
            inboxStore.setRead(ids, false);
            toast.error('Could not update your notifications. Please try again.');
        }
    }, []);

    const markAsRead = useCallback((id: string) => updateReadState({ ids: [id] }, [id]), [updateReadState]);

    /** Marks every unread notification as read — including older ones that are not loaded yet. */
    const markAllAsRead = useCallback(
        () =>
            updateReadState(
                { all: true },
                all.filter((n) => !n.isRead).map((n) => n.id)
            ),
        [all, updateReadState]
    );

    return {
        notifications,
        // Signed out: there is nothing to load.
        status: userId ? (loaded === 'idle' ? 'loading' : loaded) : 'ready',
        hasUnread,
        hasMore,
        loadingMore: loadingMore || (mine && inbox.loadingMore),
        loadMore,
        markAsRead,
        markAllAsRead,
    } as const;
}
