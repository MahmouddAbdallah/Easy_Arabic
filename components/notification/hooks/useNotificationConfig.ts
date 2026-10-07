'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { configStore, type ConfigSnapshot } from '../lib/client/configStore';

/**
 * The notification configuration (lib/config.ts) for a signed-in user: what sections exist, how the sound is set up,
 * which settings people get. Every caller shares ONE copy (lib/client/configStore.ts): it is there at once — from the last
 * visit or the built-in defaults — and is refreshed in the background while `userId` is set. Signed out, the copy it
 * has is simply returned; nothing is fetched (the endpoint needs a session).
 */
export function useNotificationConfig(userId: string | undefined): ConfigSnapshot {
    const snapshot = useSyncExternalStore(configStore.subscribe, configStore.getSnapshot, configStore.getServerSnapshot);

    useEffect(() => {
        if (!userId) return;
        return configStore.retain();
    }, [userId]);

    return snapshot;
}
