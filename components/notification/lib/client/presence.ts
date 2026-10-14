/**
 * CLIENT ONLY — browser APIs. Never import this from server code.
 *
 * Tells the server which page this tab is showing, so sendNotification() can skip a notification about
 * the page the user is already looking at (see contract.ts: "What the user is looking at right now").
 *
 * "Looking at" means the person is working in the tab: it is visible AND its window has the focus. A tab that can
 * merely be seen — another app is in front of it, it is half covered, it sits on a second screen — is not being
 * looked at, and reporting it as such would make the server withhold the notification (the push and the stored
 * copy) for a message that arrived while the person was working somewhere else.
 *
 * There is no heartbeat and no timer that fires while nothing happens. A report is sent only when it
 * changes what the server believes, and the server trusts it for ACTIVE_CONTEXT_TTL_MS:
 *
 *   - the page settles on a location (after SETTLE_MS, so redirects and a query that changes as the user
 *     types collapse into one report for where they end up);
 *   - the person is back in the tab (visible and in focus again) after the server was told they were gone;
 *   - the user interacts after the last report is REFRESH old — "actively viewing" means they are still
 *     here, a tab left open and untouched lapses by itself and its owner is notified as usual;
 *   - the person leaves the tab — it is hidden, or another window or app took the focus — for more than
 *     HIDE_GRACE_MS, or it closes: one "not visible" report, sent at once when closing (the page may be gone a
 *     moment later) and at once when a phone or tablet puts the tab in the background (there the page may be
 *     frozen before any timer fires, and the server would go on believing the person is here for minutes).
 *     Flipping to another tab or window and straight back costs nothing.
 *
 * All best-effort: if a report is lost the server falls back to a safe default (the entry lapses, the
 * user gets a notification they could have done without — never the other way round).
 */
import { ACTIVE_CONTEXT_REFRESH_MS } from '../contract';
import { reportActiveContext } from './api';

/** A new location is reported only after it stayed unchanged this long. */
const SETTLE_MS = 300;

/** A tab hidden, or a window out of focus, for less than this has not really been left (alt-tab, a quick glance elsewhere). */
const HIDE_GRACE_MS = 3_000;

/** Any of these means a person is at the keyboard. Cheap by design: the handler returns after one comparison. */
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

let tabId: string | undefined;

/** Identifies this browser tab to the server; stays the same while the tab lives. */
function getTabId(): string {
    // crypto.randomUUID only exists in secure contexts (https / localhost).
    return (tabId ??= globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);
}

/** What the server currently holds for this tab (null: nothing — never reported, or reported as gone). */
let reported: { userId: string; link: string; at: number } | null = null;

function report(userId: string, link: string | null): void {
    if (link === null) {
        if (!reported) return; // nothing to take back
        reported = null;
    } else {
        reported = { userId, link, at: Date.now() };
    }
    reportActiveContext(getTabId(), link);
}

/** Does the server already know this user is on `location`, recently enough to need no new report? */
function isCurrent(userId: string, location: string): boolean {
    return reported !== null && reported.userId === userId && reported.link === location && Date.now() - reported.at < ACTIVE_CONTEXT_REFRESH_MS;
}

/** The person is working in this tab: it can be seen and its window is the one in use. */
function isAttending(): boolean {
    return document.visibilityState === 'visible' && document.hasFocus();
}

/** A phone or tablet: there a tab put in the background may be frozen at once, so its goodbye cannot wait for a timer. */
function isTouchFirst(): boolean {
    return window.matchMedia?.('(hover: none) and (pointer: coarse)').matches === true;
}

/**
 * Tells the server this tab is showing `location` ("/path?query") for as long as the person is working in it.
 * Call the returned function to stop. Changing location is just stopping and tracking the new one — the new
 * report replaces this tab's previous one on the server.
 */
export function trackActiveContext(userId: string, location: string): () => void {
    let settle: ReturnType<typeof setTimeout> | undefined;
    let hide: ReturnType<typeof setTimeout> | undefined;

    const cancelTimers = () => {
        clearTimeout(settle);
        clearTimeout(hide);
        settle = hide = undefined;
    };

    const publishNow = () => {
        cancelTimers();
        report(userId, location);
    };

    const sync = () => {
        cancelTimers();
        if (isAttending()) {
            if (!isCurrent(userId, location)) settle = setTimeout(publishNow, SETTLE_MS);
            return;
        }

        if (document.visibilityState === 'hidden' && isTouchFirst()) {
            report(userId, null);
            return;
        }
        // Checked again when the grace is over: focus can come back without an event (it moved into an iframe of the page).
        hide = setTimeout(() => {
            if (!isAttending()) report(userId, null);
        }, HIDE_GRACE_MS);
    };

    // The user is doing something: renew the report if it has aged — but only if they are working in this tab: a pointer
    // moving over a window that is not in use is not a person at the keyboard.
    const onActivity = () => {
        if (!isCurrent(userId, location) && isAttending()) publishNow();
    };

    // The tab is going away (closed, navigated off-site, frozen into the back/forward cache).
    const leave = () => {
        cancelTimers();
        report(userId, null);
    };

    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('blur', sync);
    window.addEventListener('pagehide', leave);
    window.addEventListener('pageshow', sync); // restored from the back/forward cache
    for (const type of ACTIVITY_EVENTS) document.addEventListener(type, onActivity, { passive: true, capture: true });

    return () => {
        cancelTimers();
        document.removeEventListener('visibilitychange', sync);
        window.removeEventListener('focus', sync);
        window.removeEventListener('blur', sync);
        window.removeEventListener('pagehide', leave);
        window.removeEventListener('pageshow', sync);
        for (const type of ACTIVITY_EVENTS) document.removeEventListener(type, onActivity, { capture: true });
    };
}
