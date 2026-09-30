'use client';

import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { firebaseClientDBRealTime } from '@/lib/config/firebase-client';
import { clsx } from 'cn';

interface Status {
    state: 'online' | 'offline';
    last_changed: number;
}

export default function UserStatusDisplay({ userId, ping = false, showStatus = false, typing = false }: { userId: string; ping?: boolean, showStatus?: boolean, typing?: boolean }) {
    const [status, setStatus] = useState<Status | null>(null);

    useEffect(() => {
        const statusRef = ref(firebaseClientDBRealTime, `status/${userId}`);
        const unsubscribe = onValue(statusRef, (snapshot) => {
            setStatus(snapshot.val());
        });
        return () => unsubscribe();
    }, [userId]);

    const isOnline = status?.state === 'online';

    return (
        <div className="group relative inline-flex items-center gap-2">
            <div className="relative flex size-3.5">
                {isOnline && ping && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                )}

                <span
                    className={`
                        relative inline-flex rounded-full size-3.5 border-2 border-white shadow-sm
                        ${isOnline ? 'bg-green-500' : 'bg-gray-400'}
                    `}
                />
            </div>

            {showStatus && (typing ? (
                // Replaces the Online/Offline label while the other user is typing, and steps aside
                // again (back to the normal status) as soon as they stop.
                <span className="text-[11px] font-medium text-primary animate-pulse">
                    Typing...
                </span>
            ) : (
                <span className={clsx(
                    "text-[11px] font-medium",
                    isOnline ? 'text-emerald-500' : 'text-gray-500'
                )}>
                    {isOnline ? 'Online' : 'Offline'}
                </span>
            ))}
        </div>
    );
}