import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Inbox } from 'lucide-react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from 'cn'
import { getInitials, toPreview } from '@/components/dashboard/contact/contactUtils'
import type { InboxMessage } from '@/lib/data/dashboard-overview'

interface RecentMessagesProps {
    /** `null` means the inbox couldn't be loaded (as opposed to being empty). */
    messages: InboxMessage[] | null
    unread: number
}

// "5 minutes ago" is timezone-proof; a clock time rendered on the server would show the server's zone.
const ago = (value: string | Date) => formatDistanceToNow(new Date(value), { addSuffix: true })

export default function RecentMessages({ messages, unread }: RecentMessagesProps) {
    return (
        <Card className="border-border/60">
            <CardHeader>
                <CardTitle>Latest messages</CardTitle>
                {messages && (
                    <CardDescription>{unread > 0 ? `${unread} unread` : 'You’re all caught up'}</CardDescription>
                )}
                <CardAction>
                    <Link
                        href="/dashboard/contact"
                        className="rounded-md text-xs font-semibold text-brand outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand/50"
                    >
                        Open inbox
                    </Link>
                </CardAction>
            </CardHeader>

            <CardContent className="flex-1">
                {messages === null ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                        Messages couldn&apos;t be loaded. Refresh the page to try again.
                    </p>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                        <div className="rounded-full bg-muted p-3 text-muted-foreground">
                            <Inbox className="size-5" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">No messages yet</p>
                        <p className="max-w-xs text-xs text-muted-foreground">
                            Anything sent through your public contact form will show up here.
                        </p>
                    </div>
                ) : (
                    <ul className="-mx-2 space-y-0.5">
                        {messages.map((message) => {
                            const isUnread = !message.isRead
                            const text = message.subject?.trim() || toPreview(message.message, 120)

                            return (
                                <li key={message.id}>
                                    <Link
                                        href="/dashboard/contact"
                                        className="flex items-center gap-3 rounded-lg px-2 py-2.5 outline-none transition-colors motion-reduce:transition-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-brand/50"
                                    >
                                        <span
                                            aria-hidden
                                            className={cn(
                                                'relative flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                                                isUnread
                                                    ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                                                    : 'bg-muted text-muted-foreground',
                                            )}
                                        >
                                            {getInitials(message.name, message.email)}
                                            {isUnread && (
                                                <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-blue-500 ring-2 ring-card" />
                                            )}
                                        </span>

                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-baseline justify-between gap-2">
                                                <span
                                                    className={cn(
                                                        'truncate text-sm',
                                                        isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80',
                                                    )}
                                                >
                                                    {isUnread && <span className="sr-only">Unread: </span>}
                                                    {message.name}
                                                </span>
                                                <span className="shrink-0 text-[11px] text-muted-foreground">
                                                    {ago(message.createdAt)}
                                                </span>
                                            </span>
                                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{text}</span>
                                        </span>
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </CardContent>
        </Card>
    )
}
