'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackActiveContext } from './lib/client/presence';

/**
 * Keeps the server told which page ("/path?query") the signed-in user's tab is showing, so that
 * sendNotification() can skip notifications about a page they are already looking at. Renders
 * nothing. useSearchParams() needs a <Suspense> boundary above it — NotificationProvider adds one.
 *
 * Signing out stops the reports; the last one expires on the server by itself.
 */
export function ActiveContextReporter({ userId }: { userId: string | undefined }) {
    const pathname = usePathname();
    const search = useSearchParams().toString();
    const location = search ? `${pathname}?${search}` : pathname;

    useEffect(() => {
        if (!userId) return;
        return trackActiveContext(location);
    }, [userId, location]);

    return null;
}
