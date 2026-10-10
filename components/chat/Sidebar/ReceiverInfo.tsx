'use client';

import { getUser } from '@/lib/data/users';
import { Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import UserStatusDisplay from '../UserStatusDisplay';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { userType } from '@/types/userTypes';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { clsx } from 'cn';

interface ReceiverInfoProps {
    receiverId: string;
    message: string | null;
    lastSend?: Timestamp;
    unreadCount?: number;
    isSelected: boolean;
}

const ReceiverInfo = ({
    receiverId,
    message,
    lastSend,
    unreadCount = 0,
    isSelected
}: ReceiverInfoProps) => {
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
            <div className="flex w-full items-center gap-3.5 rounded-2xl p-3 transition-colors">
                <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-28 rounded-md" />
                        <Skeleton className="h-3 w-12 rounded-md" />
                    </div>
                    <Skeleton className="h-3 w-3/4 rounded-md" />
                </div>
            </div>
        );
    }

    const formattedTime = lastSend
        ? lastSend.toDate().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        })
        : '';

    const hasUnread = unreadCount > 0;

    return (
        <div className={clsx(
            "group relative flex w-full cursor-pointer items-center gap-3.5 rounded-2xl border border-transparent p-3 transition-all duration-300 ease-out active:scale-95 active:transition-none",
            isSelected ? "border-border/60 bg-accent/40 shadow-sm  hover:border-border/90 hover:bg-accent/60 hover:shadow-sm" :
                "hover:border-border/60 hover:bg-accent/40 hover:shadow-sm"
        )}>

            {isSelected && (
                <span className="absolute left-1 top-2.5 bottom-2.5 w-1 rounded-full bg-primary shadow-sm shadow-primary/50" />
            )}
            <div className="relative shrink-0">
                <Avatar className="h-12 w-12 rounded-full border border-border/40 shadow-sm transition-transform duration-300 group-hover:scale-105">
                    <AvatarImage
                        src={receiver?.imageUrl || ''}
                        alt={receiver?.name || 'User Avatar'}
                        className="object-cover"
                    />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                        {receiver?.name?.slice(0, 2) || 'CN'}
                    </AvatarFallback>
                </Avatar>

                <div className="absolute -bottom-0.5 -right-0.5">
                    <UserStatusDisplay userId={receiverId} />
                </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 text-start">
                <div className="flex items-center justify-between gap-2">
                    <h4 className="truncate text-sm font-semibold tracking-tight text-foreground/90 transition-colors group-hover:text-foreground">
                        {receiver?.name || 'Unknown User'}
                    </h4>
                    {formattedTime && (
                        <span
                            className={`shrink-0 text-[11px] font-medium transition-colors ${hasUnread
                                ? 'text-primary font-semibold'
                                : 'text-muted-foreground/70 group-hover:text-muted-foreground'
                                }`}
                        >
                            {formattedTime}
                        </span>
                    )}
                </div>

                <div className="flex items-center justify-between gap-2">
                    <p
                        className={`truncate text-xs transition-colors ${hasUnread
                            ? 'font-medium text-foreground'
                            : 'text-muted-foreground/80 group-hover:text-muted-foreground'
                            }`}
                    >
                        {message || 'No messages yet'}
                    </p>

                    {hasUnread && (
                        <Badge className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground shadow-sm shadow-primary/25 transition-transform duration-300 group-hover:scale-110">
                            {unreadCount > 99 ? '+99' : unreadCount}
                        </Badge>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReceiverInfo;