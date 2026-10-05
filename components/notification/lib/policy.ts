/**
 * The rules that turn a user's settings into "may this notification alert them?" — one place, used by
 * the server (push) and by the browser (pop-up, sound), so the two can never disagree. Pure functions:
 * no server or browser imports, nothing to mock in a test.
 */
import { NOTIFICATION_TYPE_CONFIG, type NotificationCategory, type NotificationType } from './contract';
import { isValidTime, type NotificationSettings, type QuietHours } from './settings';

export const categoryOf = (type: NotificationType): NotificationCategory => NOTIFICATION_TYPE_CONFIG[type].category;

const clockFormats = new Map<string, Intl.DateTimeFormat>();

/** Minutes since local midnight in `timeZone` at `at`. */
function minutesOfDay(at: number, timeZone: string): number {
    let format = clockFormats.get(timeZone);
    if (!format) {
        format = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
        clockFormats.set(timeZone, format);
    }
    const parts = format.formatToParts(at);
    const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return part('hour') * 60 + part('minute');
}

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/**
 * Is `at` inside the quiet-hours window? The window is [start, end): 22:00–07:00 is quiet at 22:00 and
 * 06:59 but not at 07:00. An empty window (start = end) or an invalid one is never quiet.
 */
export function isQuietNow(quiet: QuietHours, at: number = Date.now()): boolean {
    if (!quiet.enabled || !isValidTime(quiet.start) || !isValidTime(quiet.end) || quiet.start === quiet.end) return false;

    const now = minutesOfDay(at, quiet.timeZone);
    const start = toMinutes(quiet.start);
    const end = toMinutes(quiet.end);
    return start < end ? now >= start && now < end : now >= start || now < end;
}

export interface AlertDecision {
    /** Send a push (system notification) to the user's devices. */
    push: boolean;
    /** Show an in-app pop-up. */
    popup: boolean;
    /** Play a sound. */
    sound: boolean;
}

const SILENT: AlertDecision = { push: false, popup: false, sound: false };

/**
 * How a notification of `type` may alert someone with these settings, at time `at`:
 *   paused, or its category muted     → no alert at all (it is still stored and counted)
 *   inside quiet hours                → no push and no sound; a pop-up is still fine
 *   otherwise                         → push; pop-up and sound as chosen
 */
export function decideAlerts(settings: NotificationSettings, type: NotificationType, at: number = Date.now()): AlertDecision {
    if (!settings.enabled || !settings.categories[categoryOf(type)]) return SILENT;
    if (isQuietNow(settings.quietHours, at)) return { push: false, popup: settings.popups, sound: false };
    return { push: true, popup: settings.popups, sound: settings.sound };
}
