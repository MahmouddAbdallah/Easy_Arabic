/**
 * CLIENT ONLY — no browser APIs of its own: everything it touches is passed in, so the logic can be
 * exercised without a page.
 *
 * The one place that decides how a notification that arrives while the app is open is shown. Two sources
 * feed it, because a notification can reach an open page by two independent routes:
 *
 *   'push'   a push message the service worker handed to the page (needs push permission);
 *   'inbox'  the stored copy appearing in the live list (works for everyone, push or not).
 *
 * They often describe the same notification a moment apart. The send id (`NotificationPayload.id`, kept on
 * the stored copy as `sendId`) tells them apart from genuinely new ones, so the person gets one pop-up and
 * one sound whichever route is faster.
 *
 * What it then decides is policy.ts, shared with the server: paused / muted or disabled section / quiet hours /
 * pop-ups off / sound off — under the admin's notification configuration (config.ts). Two more rules are about the moment rather than the person:
 *   - a hidden tab shows nothing (the system notification or the list covers it);
 *   - a notification about the page the user is looking at right now tells them nothing new — the server
 *     already skips these, this catches the case where its record of the tab had lapsed.
 */
import type { NotificationConfig } from '../config';
import type { NotificationPayload } from '../contract';
import { decideAlerts } from '../policy';
import type { NotificationSettings } from '../settings';

export interface Alert {
    payload: NotificationPayload;
    source: 'push' | 'inbox';
}

export interface AlertEnvironment {
    settings(): NotificationSettings;
    /** The notification configuration in force (which section a type belongs to, whether it is switched off, whether sound is on). */
    config(): NotificationConfig;
    /** Is the tab visible? */
    isVisible(): boolean;
    /** Is the user already on `link`? */
    isViewing(link: string): boolean;
    showPopup(payload: NotificationPayload): void;
    playSound(id: string): void;
    now(): number;
}

/** How long a send id is remembered; a push and its stored copy arrive within seconds of each other. */
const REMEMBER_MS = 2 * 60_000;
const REMEMBER_MAX = 200;

export interface AlertCenter {
    /** Offers an arrived notification. Returns what was done with it, for tests and debugging. */
    offer(alert: Alert): 'shown' | 'duplicate' | 'hidden' | 'viewing' | 'silent';
}

export function createAlertCenter(env: AlertEnvironment): AlertCenter {
    const seen = new Map<string, number>();

    function remember(id: string, now: number): boolean {
        for (const [known, at] of seen) {
            if (now - at < REMEMBER_MS && seen.size < REMEMBER_MAX) break; // Map keeps insertion order: the rest is newer
            seen.delete(known);
        }
        if (seen.has(id)) return false;
        seen.set(id, now);
        return true;
    }

    return {
        offer({ payload }) {
            const now = env.now();
            if (!remember(payload.id, now)) return 'duplicate';
            if (!env.isVisible()) return 'hidden';
            if (payload.link && env.isViewing(payload.link)) return 'viewing';

            const decision = decideAlerts(env.settings(), payload.type, now, env.config());
            if (!decision.popup && !decision.sound) return 'silent';

            if (decision.popup) env.showPopup(payload);
            if (decision.sound) env.playSound(payload.id);
            return 'shown';
        },
    };
}
