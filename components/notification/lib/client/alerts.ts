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
 * pop-ups off / sound off — under the admin's notification configuration (config.ts). Three more rules are about the moment rather than the person:
 *   - a hidden tab shows nothing (the system notification or the list covers it);
 *   - a tab that can be seen but is not the one the person is working in (another app is in front of it, it is half
 *     covered, it sits on a second screen) shows nothing either WHEN a system notification is on its way: that is the
 *     alert they will notice, and a pop-up inside a window nobody is looking at would only be an unseen second copy.
 *     A device that cannot show system notifications still gets the pop-up;
 *   - a notification about the page the user is looking at right now tells them nothing new — the server
 *     already skips these, this catches the case where its record of the tab had lapsed.
 *
 * The service worker asks the page whether it took a pushed notification, and draws a system notification itself
 * when the answer is no. `takenInApp` turns what `offer` did into that answer.
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
    /** Is the person working in this tab — it is visible and its window is the one in use (not another app, not another window)? */
    isFocused(): boolean;
    /** Will a system notification reach this device (push permitted, registered, not turned off here)? */
    pushActive(): boolean;
    /** Is the user already on `link`? */
    isViewing(link: string): boolean;
    showPopup(payload: NotificationPayload): void;
    playSound(id: string): void;
    now(): number;
}

/** How long a send id is remembered; a push and its stored copy arrive within seconds of each other. */
const REMEMBER_MS = 2 * 60_000;
const REMEMBER_MAX = 200;

export type AlertOutcome = 'shown' | 'duplicate' | 'hidden' | 'background' | 'viewing' | 'silent';

export interface AlertCenter {
    /** Offers an arrived notification. Returns what was done with it, for the service-worker bridge (see `takenInApp`), tests and debugging. */
    offer(alert: Alert): AlertOutcome;
}

/**
 * Was the notification dealt with inside the app? Yes when it was shown — and also when showing nothing was the right
 * thing: the person is looking at that very page, chose no pop-ups and no sound, or it was already shown. They are in
 * the app, so a system notification on top would be the duplication they opted out of. No when nobody could see
 * anything: the tab is hidden, or it is not the one in use while a system notification covers it.
 */
export function takenInApp(outcome: AlertOutcome): boolean {
    return outcome !== 'hidden' && outcome !== 'background';
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
            if (!env.isVisible()) return 'hidden';

            const decision = decideAlerts(env.settings(), payload.type, now, env.config());
            if (!env.isFocused() && env.pushActive() && decision.push) return 'background';

            // Only a notification that gets this far is remembered: one that nothing was shown for (hidden, background)
            // must stay free to be shown if the same send arrives again by the other route once the person is here.
            if (!remember(payload.id, now)) return 'duplicate';
            if (payload.link && env.isViewing(payload.link)) return 'viewing';
            if (!decision.popup && !decision.sound) return 'silent';

            if (decision.popup) env.showPopup(payload);
            if (decision.sound) env.playSound(payload.id);
            return 'shown';
        },
    };
}
