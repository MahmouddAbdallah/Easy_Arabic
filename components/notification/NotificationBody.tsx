'use client';

import { useRef, useState } from 'react';
import { Bell, CheckCheck, LoaderCircle, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppContext } from '../AppContext';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { useNotifications } from './hooks/useNotifications';
import { NotificationItem } from './NotificationItem';
import { NotificationSettingsPanel } from './NotificationSettingsPanel';
import { useOptionalNotificationControls } from './NotificationProvider';

interface NotificationBodyProps {
    /** How many notifications to load at first and on each "Load more". */
    pageSize?: number;
    className?: string;
}

/**
 * The signed-in user's in-app notification list, live from Firestore, with the notification settings one
 * click away. Drop it anywhere inside the app — it needs no props and no push permission. The settings
 * screen appears when a NotificationProvider is above it (the app root has one); without it the list works
 * on its own.
 */
export default function NotificationBody({ pageSize, className }: NotificationBodyProps) {
    const { user } = useAppContext();
    const { notifications, status, hasUnread, hasMore, loadingMore, loadMore, markAsRead, markAllAsRead } =
        useNotifications(user?.id, pageSize);
    const { push, settingsState, config } = useOptionalNotificationControls();

    const [view, setView] = useState<'list' | 'settings'>('list');
    const settingsButton = useRef<HTMLButtonElement>(null);

    const closeSettings = () => {
        setView('list');
        // The button that opened the settings is back on screen: leave the keyboard user where they were.
        requestAnimationFrame(() => settingsButton.current?.focus());
    };

    if (view === 'settings' && settingsState) {
        return (
            <section aria-label="Notification settings" className={cn('mx-auto w-full max-w-2xl p-4', className)}>
                <NotificationSettingsPanel settingsState={settingsState} push={push} config={config} onBack={closeSettings} />
            </section>
        );
    }

    return (
        <section aria-labelledby="notifications-title" className={cn('mx-auto flex w-full max-w-2xl flex-col gap-4 p-4', className)}>
            <header className="flex items-center justify-between gap-2">
                <h2 id="notifications-title" className="text-lg font-semibold">
                    Notifications
                </h2>
                <div className="flex items-center gap-1.5">
                    {hasUnread && (
                        <Button type="button" variant="outline" size="sm" onClick={() => void markAllAsRead()}>
                            <CheckCheck />
                            Mark all as read
                        </Button>
                    )}
                    {settingsState && (
                        <Button
                            ref={settingsButton}
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setView('settings')}
                            aria-label="Notification settings"
                            title="Notification settings"
                        >
                            <Settings />
                        </Button>
                    )}
                </div>
            </header>

            {status === 'loading' && (
                <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading notifications">
                    {Array.from({ length: 4 }, (_, i) => (
                        <Skeleton key={i} className="h-20 rounded-lg" />
                    ))}
                </div>
            )}

            {status === 'error' && (
                <p role="alert" className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
                    We couldn&apos;t load your notifications. Please try again later.
                </p>
            )}

            {status === 'ready' && notifications.length === 0 && (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-10 text-center">
                    <Bell className="size-8 text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm font-medium">No notifications yet</p>
                    <p className="text-sm text-muted-foreground">New notifications will show up here.</p>
                </div>
            )}

            {status === 'ready' && notifications.length > 0 && (
                <>
                    <ul className="flex flex-col gap-2">
                        {notifications.map((notification) => (
                            <NotificationItem key={notification.id} notification={notification} onMarkRead={markAsRead} />
                        ))}
                    </ul>

                    {hasMore && (
                        <Button type="button" variant="outline" onClick={() => void loadMore()} disabled={loadingMore} className="self-center">
                            {loadingMore && <LoaderCircle className="animate-spin" />}
                            {loadingMore ? 'Loading…' : 'Load more'}
                        </Button>
                    )}
                </>
            )}
        </section>
    );
}
