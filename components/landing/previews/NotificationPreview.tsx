import { Bell, BookOpen, Check, MessageCircle, type LucideIcon } from 'lucide-react';
import { LogoIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

interface ExampleNotification {
    icon: LucideIcon;
    title: string;
    body: string;
    time: string;
    unread: boolean;
}

const INBOX: readonly ExampleNotification[] = [
    {
        icon: MessageCircle,
        title: 'New message from Teacher Hana',
        body: 'Layla did beautifully with her Tajweed today.',
        time: '2 minutes ago',
        unread: true,
    },
    {
        icon: BookOpen,
        title: 'Lesson recorded',
        body: 'Tajweed & Memorization · Attended · Excellent',
        time: '1 hour ago',
        unread: true,
    },
    {
        icon: BookOpen,
        title: 'Lesson scheduled',
        body: 'Saturday, 45 minutes with Teacher Hana',
        time: 'Yesterday',
        unread: false,
    },
];

const UNREAD_COUNT = INBOX.filter((item) => item.unread).length;

/**
 * An illustration of notifications: a push alert as it appears on a phone, above the in-app inbox
 * with unread rows. Static markup in the same visual language as the real inbox rows.
 * Render it inside <PreviewFrame>.
 */
export default function NotificationPreview() {
    return (
        <>
            {/* On the device */}
            <div className="space-y-3 bg-linear-to-b from-brand-soft to-muted/40 p-4 sm:p-5">
                <p className="text-xs font-semibold text-muted-foreground">On your phone</p>
                <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/95 p-3.5 shadow-lg backdrop-blur">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft ring-1 ring-brand/20">
                        <LogoIcon className="size-6 fill-brand stroke-brand" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                            <p className="text-xs font-semibold text-muted-foreground">Easy Arabic</p>
                            <p className="shrink-0 text-[11px] text-muted-foreground">now</p>
                        </div>
                        <p className="truncate text-sm font-bold text-foreground">Teacher Hana</p>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                            Layla did beautifully with her Tajweed today.
                        </p>
                    </div>
                </div>
            </div>

            {/* In the app */}
            <div className="space-y-3 border-t border-border/60 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <Bell className="size-4 text-brand" />
                        Notifications
                    </p>
                    <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-brand-foreground">
                        {UNREAD_COUNT} unread
                    </span>
                </div>

                <ul className="space-y-2.5">
                    {INBOX.map(({ icon: Icon, title, body, time, unread }) => (
                        <li
                            key={title}
                            className={cn(
                                'flex items-start gap-3 rounded-xl border border-border p-3',
                                unread ? 'bg-brand/5' : 'bg-card'
                            )}
                        >
                            <span
                                className={cn(
                                    'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                                    unread ? 'bg-brand/10 text-brand' : 'bg-muted text-muted-foreground'
                                )}
                            >
                                <Icon className="size-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="flex items-center gap-2 text-sm">
                                    {unread && <span className="size-2 shrink-0 rounded-full bg-brand" />}
                                    <span className={cn('truncate', unread ? 'font-semibold' : 'font-medium')}>
                                        {title}
                                    </span>
                                </p>
                                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{body}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{time}</p>
                            </div>
                            {unread && (
                                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center text-muted-foreground">
                                    <Check className="size-4" />
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </>
    );
}
