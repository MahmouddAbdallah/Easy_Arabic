'use client';

import { Timestamp } from 'firebase/firestore';
import { memo } from 'react';
import { cn } from 'cn';
import { GroupAvatar } from '../Groups/GroupAvatar';
import { formatListTime } from '../lib/listTime';

interface GroupRowProps {
    name: string;
    imageUrl?: string | null;
    /** The line under the name: the newest message with who wrote it (see getGroupPreview). */
    preview: string;
    lastSend?: Timestamp;
    unreadCount?: number;
    isSelected: boolean;
    /** The current day (shared by every row). */
    today: Date;
}

/**
 * One group in the list. It looks exactly like a direct conversation (ReceiverInfo): the group's picture instead of
 * a person's, no presence dot (a group is not "online"), and a preview that says who wrote the last message.
 * Everything it shows is in the chat document the list already has, so a group needs no lookup of its own.
 */
const GroupRow = memo(function GroupRow({ name, imageUrl, preview, lastSend, unreadCount = 0, isSelected, today }: GroupRowProps) {
    const time = lastSend ? formatListTime(lastSend.toDate(), today) : '';
    const hasUnread = unreadCount > 0;

    return (
        <div
            className={cn(
                'group relative flex w-full cursor-pointer items-center gap-3.5 rounded-2xl p-3 transition-colors',
                isSelected ? 'bg-(--chat-accent-soft)' : 'hover:bg-(--chat-surface-2) active:bg-(--chat-surface-3)'
            )}
        >
            <GroupAvatar imageUrl={imageUrl} pixels={104} className="size-[52px] shrink-0" />

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 text-start">
                <div className="flex items-baseline justify-between gap-2">
                    <h4 dir="auto" className={cn('truncate text-[15px] text-(--chat-ink)', hasUnread ? 'font-semibold' : 'font-medium')}>
                        {name}
                    </h4>
                    {time && (
                        <span className={cn('shrink-0 text-xs tabular-nums', hasUnread ? 'font-semibold text-(--chat-accent-text)' : 'text-(--chat-ink-3)')}>
                            {time}
                        </span>
                    )}
                </div>

                <div className="flex items-center justify-between gap-2">
                    <p dir="auto" className={cn('truncate text-start text-sm', hasUnread ? 'font-medium text-(--chat-ink)' : 'text-(--chat-ink-2)')}>
                        {preview}
                    </p>

                    {hasUnread && (
                        <span
                            aria-label={`${unreadCount} unread`}
                            className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-(--chat-accent) px-1.5 text-xs font-semibold tabular-nums text-(--chat-accent-ink)"
                        >
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
});

export default GroupRow;
