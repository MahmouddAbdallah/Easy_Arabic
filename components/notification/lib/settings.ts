/**
 * Notification settings — what a user chose, in one shape shared by the server (which enforces it when
 * sending), the browser (which enforces it when alerting) and the settings UI. No server or browser
 * imports, no zod: safe to bundle anywhere. Validation of what arrives over HTTP is in schema.ts.
 *
 *   enabled     master switch. Off = pause every alert (push, pop-ups, sound). The in-app list still fills
 *               up and the unread badge still counts, so nothing is lost while paused.
 *   popups      show a pop-up (toast) for a new notification while the app is open.
 *   sound       play a sound for a new notification — the in-app chime, and an audible (rather than silent)
 *               system notification where the browser allows it.
 *   categories  one switch per kind of notification (contract.ts maps every type to one). Off = no alert for
 *               that kind, but it is still listed.
 *   quietHours  a daily window with no push and no sound; pop-ups still appear because the person is
 *               plainly using the app. `timeZone` is an IANA name so the window follows the person, not the server.
 *
 * Push on a particular DEVICE is not here: that is the browser's permission plus a registered token
 * (lib/client/device.ts), not an account preference.
 */
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from './contract';

export interface QuietHours {
    enabled: boolean;
    /** "HH:mm", 24-hour. */
    start: string;
    /** "HH:mm", 24-hour. A window that ends before it starts runs overnight (22:00 → 07:00). */
    end: string;
    /** IANA time zone, e.g. "Africa/Cairo". */
    timeZone: string;
}

export interface NotificationSettings {
    enabled: boolean;
    popups: boolean;
    sound: boolean;
    categories: Record<NotificationCategory, boolean>;
    quietHours: QuietHours;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** A change to the settings: any subset of them, nested groups included. */
export type NotificationSettingsPatch = DeepPartial<NotificationSettings>;

export const DEFAULT_QUIET_HOURS: QuietHours = { enabled: false, start: '22:00', end: '07:00', timeZone: 'UTC' };

export const DEFAULT_SETTINGS: NotificationSettings = {
    enabled: true,
    popups: true,
    sound: true,
    categories: Object.fromEntries(NOTIFICATION_CATEGORIES.map((category) => [category, true])) as Record<
        NotificationCategory,
        boolean
    >,
    quietHours: DEFAULT_QUIET_HOURS,
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isValidTime = (value: unknown): value is string => typeof value === 'string' && TIME.test(value);

const knownTimeZones = new Set<string>();

export function isValidTimeZone(value: unknown): value is string {
    if (typeof value !== 'string' || value.length === 0 || value.length > 64) return false;
    if (knownTimeZones.has(value)) return true;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        knownTimeZones.add(value);
        return true;
    } catch {
        return false;
    }
}

const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

/**
 * Turns whatever is stored (or cached) into valid settings: a missing document, a missing field or a
 * field of the wrong type falls back to its default, and unknown fields are ignored. Never throws, so a
 * damaged document can never stop a notification or crash the settings screen.
 */
export function normalizeSettings(raw: unknown): NotificationSettings {
    const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    const categories = typeof source.categories === 'object' && source.categories !== null ? (source.categories as Record<string, unknown>) : {};
    const quiet = typeof source.quietHours === 'object' && source.quietHours !== null ? (source.quietHours as Record<string, unknown>) : {};

    return {
        enabled: bool(source.enabled, DEFAULT_SETTINGS.enabled),
        popups: bool(source.popups, DEFAULT_SETTINGS.popups),
        sound: bool(source.sound, DEFAULT_SETTINGS.sound),
        categories: Object.fromEntries(
            NOTIFICATION_CATEGORIES.map((category) => [category, bool(categories[category], true)])
        ) as Record<NotificationCategory, boolean>,
        quietHours: {
            enabled: bool(quiet.enabled, DEFAULT_QUIET_HOURS.enabled),
            start: isValidTime(quiet.start) ? quiet.start : DEFAULT_QUIET_HOURS.start,
            end: isValidTime(quiet.end) ? quiet.end : DEFAULT_QUIET_HOURS.end,
            timeZone: isValidTimeZone(quiet.timeZone) ? quiet.timeZone : DEFAULT_QUIET_HOURS.timeZone,
        },
    };
}

/** `settings` with `patch` applied on top (nested groups merge field by field). */
export function applySettingsPatch(settings: NotificationSettings, patch: NotificationSettingsPatch): NotificationSettings {
    return normalizeSettings({
        ...settings,
        ...patch,
        categories: { ...settings.categories, ...patch.categories },
        quietHours: { ...settings.quietHours, ...patch.quietHours },
    });
}

/** Combines two patches into one that has the same effect as applying `first` then `second`. */
export function mergePatches(first: NotificationSettingsPatch, second: NotificationSettingsPatch): NotificationSettingsPatch {
    const merged: NotificationSettingsPatch = { ...first, ...second };
    if (first.categories || second.categories) merged.categories = { ...first.categories, ...second.categories };
    if (first.quietHours || second.quietHours) merged.quietHours = { ...first.quietHours, ...second.quietHours };
    return merged;
}
