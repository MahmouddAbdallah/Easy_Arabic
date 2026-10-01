'use client';
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firebaseClientDB } from '@/lib/config/firebase-client';
import { useAppContext } from '../AppContext';
import { Badge } from '../ui/badge';
import { clsx } from 'cn';

const UnReadMsgCount = () => {
    const [unReadCount, setUnReadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const { user } = useAppContext()
    useEffect(() => {
        if (!user?.id) return;

        const unsubscribe = onSnapshot(
            doc(firebaseClientDB, 'unreadMessageCount', user?.id),
            (snapshot) => {
                // The document doesn't exist until the user's first unread message, so default to 0.
                const count = snapshot.get('count');
                setUnReadCount(typeof count === 'number' && count > 0 ? count : 0);
                setLoading(false);
            },
            (error) => {
                console.error('Error listening to the unread message count: ', error);
                setLoading(false);
            }
        );

        return unsubscribe; // stop listening on unmount or when the user changes
    }, [user?.id]);

    if (loading || unReadCount === 0) return null;

    return <>
        <Badge
            className={clsx(' flex justify-center items-center text-[10px] bg-destructive text-destructive-foreground size-5 rounded-full font-semibold z-10 select-none',
                'absolute -top-1 -right-1'
            )}
        >
            {unReadCount > 99 ? '99+' : unReadCount}
        </Badge>
    </>;
};

export default UnReadMsgCount;