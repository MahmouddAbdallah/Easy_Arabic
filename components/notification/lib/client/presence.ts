/**
 * CLIENT ONLY — browser APIs. Never import this from server code.
 *
 * Tells the server which page this tab is showing, so sendNotification() can skip a notification about
 * the page the user is already looking at (see contract.ts: "What the user is looking at right now").
 * Reports are the main source of notification traffic, so they are kept to what the server needs:
 *
 *   - while the tab is visible: one report per page (after it has settled) and one per heartbeat;
 *   - hidden or closing: one "not visible" report, sent at once — the page may be gone a moment later —
 *     and never repeated, and never sent for a tab that was never visible;
 *   - bursts collapse: redirects, or a URL whose query changes as the user types, produce one report
 *     for the page the user ends up on, not one per step.
 */
import { ACTIVE_CONTEXT_HEARTBEAT_MS } from '../contract';
import { reportActiveContext } from './api';

/** A new location is reported only after it stayed unchanged this long. */
const SETTLE_MS = 300;

let tabId: string | undefined;

/** Identifies this browser tab to the server; stays the same while the tab lives. */
function getTabId(): string {
    // crypto.randomUUID only exists in secure contexts (https / localhost).
    return (tabId ??= globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);
}

/** True while the server holds no entry for this tab: nothing reported yet, or the last report was "not visible". */
let retracted = true;

function report(link: string | null): void {
    if (link === null) {
        if (retracted) return; // nothing to take back
        retracted = true;
    } else {
        retracted = false;
    }
    reportActiveContext(getTabId(), link);
}

/**
 * Tells the server this tab is showing `location` ("/path?query") for as long as the tab is visible.
 * Call the returned function to stop. Changing location is just stopping and tracking the new one —
 * the new report replaces this tab's previous one on the server. Best-effort: if a report never
 * arrives the server simply stops trusting the previous one after its TTL.
 */
export function trackActiveContext(location: string): () => void {
    let settle: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
        clearTimeout(settle);
        clearInterval(heartbeat);
    };

    const sync = () => {
        stop();
        if (document.visibilityState !== 'visible') {
            report(null);
            return;
        }
        settle = setTimeout(() => {
            report(location);
            heartbeat = setInterval(() => report(location), ACTIVE_CONTEXT_HEARTBEAT_MS);
        }, SETTLE_MS);
    };

    // The tab is going away (closed, navigated off-site, frozen into the back/forward cache).
    const leave = () => {
        stop();
        report(null);
    };

    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', leave);

    return () => {
        stop();
        document.removeEventListener('visibilitychange', sync);
        window.removeEventListener('pagehide', leave);
    };
}
