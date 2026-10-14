'use client';

import { getUser } from '@/lib/data/users';
import { Timestamp } from 'firebase/firestore';
import { memo, useEffect, useState } from 'react';
import UserStatusDisplay from '../UserStatusDisplay';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { userType } from '@/types/userTypes';
import { formatListTime } from '../lib/listTime';
import { cn } from 'cn';

interface ReceiverInfoProps {
    receiverId: string;
    message: string | null;
    lastSend?: Timestamp;
    unreadCount?: number;
    isSelected: boolean;
    /** The current day (shared by every row). */
    today: Date;
}

/** One conversation in the list: who, the last words, when, and how many are unread. */
const ReceiverInfo = memo(function ReceiverInfo({ receiverId, message, lastSend, unreadCount = 0, isSelected, today }: ReceiverInfoProps) {
    const [receiver, setReceiver] = useState<Partial<userType> | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReceiver = async () => {
            if (!receiverId) return;
            try {
                setLoading(true);
                const { data } = await getUser(receiverId);
                if (data) setReceiver(data);
            } catch (error) {
                console.error('Failed to fetch receiver:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchReceiver();
    }, [receiverId]);

    if (loading) {
        return (
            <div className="flex w-full items-center gap-3.5 rounded-2xl p-3">
                <div className="chat-skeleton size-[52px] shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2.5">
                    <div className="flex justify-between gap-6">
                        <div className="chat-skeleton h-3.5 w-28 rounded-md" />
                        <div className="chat-skeleton h-3 w-10 rounded-md" />
                    </div>
                    <div className="chat-skeleton h-3 w-3/4 rounded-md" />
                </div>
            </div>
        );
    }

    const time = lastSend ? formatListTime(lastSend.toDate(), today) : '';
    const hasUnread = unreadCount > 0;

    return (
        <div
            className={cn(
                'group relative flex w-full cursor-pointer items-center gap-3.5 rounded-2xl p-3 transition-colors',
                isSelected ? 'bg-(--chat-accent-soft)' : 'hover:bg-(--chat-surface-2) active:bg-(--chat-surface-3)'
            )}
        >
            <div className="relative shrink-0">
                <Avatar className="size-[52px] bg-(--chat-accent-soft) ring-1 ring-(--chat-line)">
                    <AvatarImage src={receiver?.imageUrl || ''} alt={receiver?.name || 'User Avatar'} className="object-cover" />
                    <AvatarFallback className="bg-(--chat-accent-soft) text-base font-semibold uppercase text-(--chat-accent-text)">
                        {receiver?.name?.slice(0, 2) || '?'}
                    </AvatarFallback>
                </Avatar>

                <div className="absolute -bottom-0.5 -end-0.5">
                    <UserStatusDisplay userId={receiverId} />
                </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 text-start">
                <div className="flex items-baseline justify-between gap-2">
                    <h4 className={cn('truncate text-[15px] text-(--chat-ink)', hasUnread ? 'font-semibold' : 'font-medium')}>
                        {receiver?.name || 'Unknown user'}
                    </h4>
                    {time && (
                        <span className={cn('shrink-0 text-xs tabular-nums', hasUnread ? 'font-semibold text-(--chat-accent-text)' : 'text-(--chat-ink-3)')}>
                            {time}
                        </span>
                    )}
                </div>

                <div className="flex items-center justify-between gap-2">
                    {/* dir="auto": an Arabic preview reads right-to-left, an English one left-to-right. */}
                    <p dir="auto" className={cn('truncate text-start text-sm', hasUnread ? 'font-medium text-(--chat-ink)' : 'text-(--chat-ink-2)')}>
                        {message || 'No messages yet'}
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

export default ReceiverInfo;
