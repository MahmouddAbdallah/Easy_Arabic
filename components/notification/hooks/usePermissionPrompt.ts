'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { PROMPT_STORAGE_PREFIX, promptGate } from '../lib/client/promptGate';
import type { PushRegistration } from './usePushRegistration';

/** The prompt waits a little after the app opens: asking before the person has seen anything is rude. */
export const PROMPT_DELAY_MS = 8_000;

export interface PermissionPrompt {
    visible: boolean;
    /** "Turn on notifications": asks the browser (its dialog is the one the person answers). */
    accept: () => Promise<void>;
    /** "Not now" / ×: hides the prompt and keeps it away for 7 days. */
    dismiss: () => void;
}

interface Options {
    userId: string | undefined;
    push: PushRegistration;
    /** Notifications are not paused (asking someone who paused them to turn them on would be silly). */
    notificationsEnabled: boolean;
}

/**
 * When to show OUR "turn on notifications" prompt — the friendly one that comes before the browser's own
 * dialog (which a person who is not ready for it tends to block for good).
 *
 * It appears only when asking can work and is welcome:
 *   - the browser supports push and has not been asked yet (permission "default") — a browser that said
 *     "block" is never asked again, and one that said "allow" needs no prompt;
 *   - the person has not turned push off on this device, and has not paused notifications;
 *   - they have not dismissed or rejected it within the last 7 days (lib/client/promptGate.ts).
 */
export function usePermissionPrompt({ userId, push, notificationsEnabled }: Options): PermissionPrompt {
    const [visible, setVisible] = useState(false);
    const [version, setVersion] = useState(0); // bumped when another tab changes the dismissal

    const canAsk = useMemo(
        () =>
            Boolean(userId) &&
            push.isSupported === true &&
            push.permission === 'default' &&
            !push.isOptedOut &&
            notificationsEnabled &&
            !promptGate.isSuppressed(userId as string),
        // `version` re-evaluates the gate after a dismissal elsewhere.
        [userId, push.isSupported, push.permission, push.isOptedOut, notificationsEnabled, version]
    );

    useEffect(() => {
        if (!canAsk) {
            setVisible(false);
            return;
        }
        const timer = setTimeout(() => {
            if (document.visibilityState === 'visible') setVisible(true);
        }, PROMPT_DELAY_MS);
        return () => clearTimeout(timer);
    }, [canAsk]);

    // Dismissed in another tab: this one should not keep showing it.
    useEffect(() => {
        const onStorage = (event: StorageEvent) => {
            if (event.key?.startsWith(PROMPT_STORAGE_PREFIX)) setVersion((v) => v + 1);
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const dismiss = useCallback(() => {
        if (userId) promptGate.recordDismissal(userId);
        setVisible(false);
        setVersion((v) => v + 1);
    }, [userId]);

    const accept = useCallback(async () => {
        setVisible(false);
        // enableNotifications records a dismissal itself when the browser answers anything but "allow".
        const enabled = await push.enableNotifications();
        setVersion((v) => v + 1);
        if (enabled) toast.success("Notifications are on. We'll let you know when something needs you.");
    }, [push]);

    return { visible: visible && canAsk, accept, dismiss };
}
