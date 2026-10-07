'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { doc, onSnapshot } from 'firebase/firestore';
import { firebaseClientDB } from '@/lib/config/firebase-client';
import { saveSettings, saveSettingsOnExit } from '../lib/client/api';
import { DEFAULT_NOTIFICATION_CONFIG, type NotificationConfig } from '../lib/config';
import { NOTIFICATION_SETTINGS_COLLECTION } from '../lib/contract';
import {
    mergePatches,
    normalizeSettings,
    pickStoredSettings,
    type NotificationSettings,
    type NotificationSettingsPatch,
} from '../lib/settings';

export interface NotificationSettingsState {
    settings: NotificationSettings;
    /** `loading` until the first answer; `error` if the settings cannot be read (the last known ones are used). */
    status: 'loading' | 'ready' | 'error';
    /** Changes some of the settings. Takes effect at once; saving is batched. */
    update: (patch: NotificationSettingsPatch) => void;
    /** Is a change still waiting to be saved? */
    saving: boolean;
}

/** Settings are shown from here until the first snapshot arrives, so the app does not flash its defaults. */
const CACHE_PREFIX = 'notification:settings:';

/** Rapid changes (a toggle clicked twice, a time being adjusted) are sent as one request. */
const SAVE_DELAY_MS = 400;

/** What this person chose, as last seen (nothing, if there is no copy). Only choices are kept — see ../lib/settings.ts. */
function readCache(userId: string): NotificationSettingsPatch {
    try {
        return pickStoredSettings(JSON.parse(localStorage.getItem(CACHE_PREFIX + userId) ?? 'null'));
    } catch {
        return {};
    }
}

function writeCache(userId: string, stored: NotificationSettingsPatch) {
    try {
        localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify(stored));
    } catch {
        /* ignore */
    }
}

const hasChanges = (patch: NotificationSettingsPatch) => Object.keys(patch).length > 0;

/**
 * The signed-in user's notification settings (Firestore document `notificationSettings/{userId}`):
 *  - ONE listener on that document — a change made in another tab or on another device shows up at once;
 *  - changes apply immediately in the UI and are saved through the API after a short pause, in order and
 *    never more than one request at a time; a change that cannot be saved is rolled back with a message.
 *
 * While changes are unsaved or being saved, incoming snapshots are held back and applied afterwards, so
 * the screen never flickers back to an old value in the middle of an edit.
 *
 * What the hook keeps is what the person CHOSE (`stored`). The `settings` it returns are those choices resolved
 * against the notification configuration (`config`: configured defaults, locked controls, the sections that
 * exist — see ../lib/settings.ts). Resolving at read time means a configuration change reaches the screen and
 * the alerts at once, with nothing the person chose lost or overwritten.
 */
export function useNotificationSettingsState(
    userId: string | undefined,
    config: NotificationConfig = DEFAULT_NOTIFICATION_CONFIG
): NotificationSettingsState {
    const [stored, setStored] = useState<NotificationSettingsPatch>({});
    const [unsent, setUnsent] = useState<NotificationSettingsPatch>({});
    const [status, setStatus] = useState<NotificationSettingsState['status']>('loading');
    const [saving, setSaving] = useState(false);

    const storedRef = useRef(stored);
    const unsentRef = useRef<NotificationSettingsPatch>({});
    const busyRef = useRef(false);
    const heldSnapshot = useRef<NotificationSettingsPatch | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const setStoredState = useCallback((next: NotificationSettingsPatch) => {
        storedRef.current = next;
        setStored(next);
    }, []);

    useEffect(() => {
        clearTimeout(timer.current);
        unsentRef.current = {};
        heldSnapshot.current = null;
        setUnsent({});
        setSaving(false);

        if (!userId) {
            setStoredState({});
            setStatus('loading');
            return;
        }

        setStoredState(readCache(userId));
        setStatus('loading');

        return onSnapshot(
            doc(firebaseClientDB, NOTIFICATION_SETTINGS_COLLECTION, userId),
            (snapshot) => {
                const next = pickStoredSettings(snapshot.data()); // a missing document means "chose nothing", so all defaults
                writeCache(userId, next);
                if (busyRef.current || hasChanges(unsentRef.current)) heldSnapshot.current = next;
                else setStoredState(next);
                setStatus('ready');
            },
            (error) => {
                // Usually the Firestore rules: the collection must be readable by its owner (see README).
                console.error('[notification] Could not listen to the notification settings:', error);
                setStatus('error');
            }
        );
    }, [userId, setStoredState]);

    const flush = useCallback(async () => {
        clearTimeout(timer.current);
        if (busyRef.current) return; // the request in flight sends whatever is waiting when it finishes

        busyRef.current = true;
        try {
            // One request at a time; changes made while it is out are sent right after, as one more.
            while (hasChanges(unsentRef.current)) {
                const batch = unsentRef.current;
                const before = storedRef.current;
                unsentRef.current = {};
                setStoredState(mergePatches(before, batch)); // from here on the screen reads it from `stored`
                setUnsent({});

                let saved = true;
                try {
                    await saveSettings(batch);
                } catch (error) {
                    saved = false;
                    console.error('[notification] Could not save the notification settings:', error);
                    toast.error('Could not save your notification settings. Please try again.');
                }

                const held = heldSnapshot.current;
                heldSnapshot.current = null;
                if (!saved) setStoredState(held ?? before);
                else if (held) setStoredState(mergePatches(held, batch)); // `held` may predate our write
            }
        } finally {
            busyRef.current = false;
            setSaving(false);
        }
    }, [setStoredState]);

    const update = useCallback(
        (patch: NotificationSettingsPatch) => {
            unsentRef.current = mergePatches(unsentRef.current, patch);
            setUnsent(unsentRef.current);
            setSaving(true);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
        },
        [flush]
    );

    // A change still waiting when the page closes must not be lost with it.
    useEffect(() => {
        const sendPending = () => {
            if (!hasChanges(unsentRef.current)) return;
            saveSettingsOnExit(unsentRef.current);
            unsentRef.current = {};
        };
        window.addEventListener('pagehide', sendPending);
        return () => {
            window.removeEventListener('pagehide', sendPending);
            sendPending();
        };
    }, []);

    const settings: NotificationSettings = useMemo(
        () => normalizeSettings(mergePatches(stored, unsent), config),
        [stored, unsent, config]
    );

    return useMemo(() => ({ settings, status, update, saving }), [settings, status, update, saving]);
}
