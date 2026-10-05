'use client';

import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import type { InAppNotification } from './lib/contract';
import { TYPE_ICONS } from './typeIcons';

interface NotificationItemProps {
    notification: InAppNotification;
    onMarkRead: (id: string) => void;
}

/** One row of the in-app notification list. */
export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
    const { id, type, title, body, link, isRead, createdAt, count } = notification;
    const Icon = TYPE_ICONS[type];

    const content = (
        <>
            <span
                className={cn(
                    'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                    isRead ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                )}
            >
                <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                    {!isRead && (
                        <>
                            <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                            <span className="sr-only">Unread:</span>
                        </>
                    )}
                    <span dir="auto" className={cn('truncate text-sm', isRead ? 'font-medium' : 'font-semibold')}>
                        {title}
                    </span>
                    {count > 1 && (
                        // The same notification was sent again while it was unread: one row, with a tally.
                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-xs font-medium tabular-nums text-muted-foreground">
                            <span aria-hidden="true">×{count}</span>
                            <span className="sr-only">, {count} times</span>
                        </span>
                    )}
                </span>
                <span dir="auto" className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">
                    {body}
                </span>
                <time dateTime={new Date(createdAt).toISOString()} className="mt-1 block text-xs text-muted-foreground">
                    {formatDistanceToNowStrict(createdAt, { addSuffix: true })}
                </time>
            </span>
        </>
    );

    const rowClass = 'flex min-w-0 flex-1 items-start gap-3 rounded-lg p-3 text-start';

    return (
        <li
            className={cn(
                'flex items-start gap-1 rounded-lg border border-border',
                isRead ? 'bg-card' : 'bg-primary/5'
            )}
        >
            {link ? (
                // Opening a notification counts as reading it.
                <Link
                    href={link}
                    onClick={() => !isRead && onMarkRead(id)}
                    className={cn(rowClass, 'outline-none focus-visible:ring-2 focus-visible:ring-ring')}
                >
                    {content}
                </Link>
            ) : (
                <div className={rowClass}>{content}</div>
            )}

            {!isRead && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onMarkRead(id)}
                    aria-label="Mark as read"
                    title="Mark as read"
                    className="m-1.5"
                >
                    <Check />
                </Button>
            )}
        </li>
    );
}
