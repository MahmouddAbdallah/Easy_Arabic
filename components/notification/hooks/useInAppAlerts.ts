'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { showNotificationToast } from '../NotificationToast';
import { createAlertCenter, type AlertCenter } from '../lib/client/alerts';
import { inboxStore } from '../lib/client/inboxStore';
import { armAudioUnlock, playNotificationSound } from '../lib/client/sound';
import { visibleCategories, type NotificationConfig } from '../lib/config';
import { NOTIFICATION_PAYLOAD_VERSION, type InAppNotification, type NotificationPayload } from '../lib/contract';
import { canonicalLocation } from '../lib/location';
import type { NotificationSettings } from '../lib/settings';

/** A stored notification, in the shape a push arrives in — so both routes feed the same alert code. */
function toPayload(notification: InAppNotification): NotificationPayload {
    const { id, sendId, type, title, body, link, key, createdAt } = notification;
    return {
        v: NOTIFICATION_PAYLOAD_VERSION,
        // Same id as the push of the same send, when there is one: that is how the two are recognised as one.
        id: sendId ?? `${id}:${createdAt}`,
        type,
        title,
        body,
        sentAt: createdAt,
        ...(link ? { link } : {}),
        ...(key ? { key } : {}),
    };
}

/**
 * Alerts for notifications that arrive while the app is open: a pop-up and a sound, as the person's
 * settings allow (see lib/client/alerts.ts for the rules), under the admin's notification configuration
 * (sections that exist or are switched off, the sound, how long a pop-up stays). Returns `offer`, which the
 * service-worker bridge uses for pushes; the stored copies appearing in the live list are wired in here.
 *
 * The live list is only kept running while there is something to alert with — if pop-ups and sound are
 * both off, or everything is paused or muted, no Firestore listener is held for alerts at all (the bell's
 * own list still starts one when it is opened).
 */
export function useInAppAlerts(userId: string | undefined, settings: NotificationSettings, config: NotificationConfig) {
    const router = useRouter();

    const settingsRef = useRef(settings);
    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    const configRef = useRef(config);
    useEffect(() => {
        configRef.current = config;
    }, [config]);

    // The alert center remembers which notifications it has already shown, so it lives as long as the page does.
    const centerRef = useRef<AlertCenter | null>(null);
    useEffect(() => {
        centerRef.current = createAlertCenter({
            settings: () => settingsRef.current,
            config: () => configRef.current,
            isVisible: () => document.visibilityState === 'visible',
            isViewing: (link) => canonicalLocation(link) === canonicalLocation(window.location.pathname + window.location.search),
            showPopup: (payload) =>
                showNotificationToast(payload, (link) => link && router.push(link), configRef.current.delivery.popupDurationMs),
            playSound: (id) => void playNotificationSound(id, configRef.current.sound),
            now: Date.now,
        });
        return () => {
            centerRef.current = null;
        };
    }, [router]);

    const offerPush = useCallback((payload: NotificationPayload) => void centerRef.current?.offer({ payload, source: 'push' }), []);

    // Is there any section that could alert this person? (Sections the admin switched off cannot.)
    const canAlert = settings.enabled && visibleCategories(config).some((category) => settings.categories[category.id] !== false);
    const wantsLiveList = Boolean(userId) && canAlert && (settings.popups || settings.sound);

    useEffect(() => {
        if (!userId || !wantsLiveList) return;

        const release = inboxStore.retain(userId);
        const stop = inboxStore.onArrival((notification) => centerRef.current?.offer({ payload: toPayload(notification), source: 'inbox' }));
        return () => {
            stop();
            release();
        };
    }, [userId, wantsLiveList]);

    // Browsers allow sound only after the person has interacted with the page: get ready for their first click.
    const wantsSound = Boolean(userId) && canAlert && settings.sound && config.sound.enabled;
    useEffect(() => {
        if (!wantsSound) return;
        return armAudioUnlock();
    }, [wantsSound]);

    // Signing out: nothing of the previous user may stay in memory.
    useEffect(() => {
        if (!userId) inboxStore.dispose();
    }, [userId]);

    return offerPush;
}
