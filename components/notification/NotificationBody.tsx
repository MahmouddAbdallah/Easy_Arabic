'use client';

import { Bell, BookOpen, MessageCircle, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NotificationPayload, NotificationType } from './lib/contract';

/** One icon per notification type — add yours here when you add a type to NOTIFICATION_TYPES. */
const TYPE_ICONS: Record<NotificationType, LucideIcon> = {
    general: Bell,
    chat_message: MessageCircle,
    lesson: BookOpen,
};

interface NotificationBodyProps {
    payload: NotificationPayload;
    /** react-hot-toast's `t.visible` — drives the enter/exit animation. */
    visible: boolean;
    /** Clicked on the notification itself (the provider navigates to `payload.link`). */
    onOpen: () => void;
    onDismiss: () => void;
}

/** The in-app (foreground) look of a notification, rendered inside a react-hot-toast toast. */
export function NotificationBody({ payload, visible, onOpen, onDismiss }: NotificationBodyProps) {
    const Icon = TYPE_ICONS[payload.type];

    return (
        <div
            role="status"
            className={cn(
                'pointer-events-auto flex w-full max-w-sm items-start gap-1 rounded-lg border border-border bg-card text-card-foreground shadow-lg',
                visible ? 'animate-in fade-in-0 slide-in-from-bottom-2' : 'animate-out fade-out-0'
            )}
        >
            {/* Without a link there is nothing to open, so a click just dismisses it. */}
            <button
                type="button"
                onClick={payload.link ? onOpen : onDismiss}
                className="flex min-w-0 flex-1 items-start gap-3 rounded-lg p-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                    <span dir="auto" className="block truncate text-sm font-semibold">
                        {payload.title}
                    </span>
                    <span dir="auto" className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">
                        {payload.body}
                    </span>
                </span>
            </button>

            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss notification"
                className="m-1.5 rounded-md p-1.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
                <X className="size-4" aria-hidden="true" />
            </button>
        </div>
    );
}
