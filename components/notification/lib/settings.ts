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
 *   categories  one switch per section of "What to be notified about". Which sections exist is the admin's
 *               configuration (config.ts), not code. Off = no alert for that kind, but it is still listed.
 *   quietHours  a daily window with no push and no sound; pop-ups still appear because the person is
 *               plainly using the app. `timeZone` is an IANA name so the window follows the person, not the server.
 *
 * Push on a particular DEVICE is not here: that is the browser's permission plus a registered token
 * (lib/client/device.ts), not an account preference.
 *
 * ── Stored choices vs effective settings ──────────────────────────────────────────────────────────────────
 * The document holds only what the person actually chose (a sparse NotificationSettingsPatch). The EFFECTIVE
 * settings — what the rest of the app reads — are those choices resolved against the configuration
 * (normalizeSettings): what they did not choose takes the configured default, a control the admin switched
 * off is locked to its default, a section the admin made mandatory is on. Because the document is never
 * rewritten by this, changing the configuration back restores exactly what each person had chosen.
 */
import {
    DEFAULT_NOTIFICATION_CONFIG,
    ownValue,
    CATEGORY_ID_PATTERN,
    type NotificationConfig,
} from './config';
import type { NotificationCategory } from './contract';
import { isValidTime, isValidTimeZone, type QuietHours } from './time';

export { DEFAULT_QUIET_HOURS } from './config';
export { isValidTime, isValidTimeZone, type QuietHours } from './time';

export interface NotificationSettings {
    enabled: boolean;
    popups: boolean;
    sound: boolean;
    /** One entry per section that exists in the configuration (true = alerts on). */
    categories: Record<NotificationCategory, boolean>;
    quietHours: QuietHours;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/**
 * A change to the settings: any subset of them, nested groups included. It is also the shape of what is
 * STORED — only the fields a person has chosen.
 */
export type NotificationSettingsPatch = DeepPartial<NotificationSettings>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The choices in `raw` (a stored document, a cached copy) that are valid, nothing else: no defaults filled
 * in, unknown fields and fields of the wrong type dropped. Never throws.
 */
export function pickStoredSettings(raw: unknown): NotificationSettingsPatch {
    const source = isRecord(raw) ? raw : {};
    const stored: NotificationSettingsPatch = {};

    if (typeof source.enabled === 'boolean') stored.enabled = source.enabled;
    if (typeof source.popups === 'boolean') stored.popups = source.popups;
    if (typeof source.sound === 'boolean') stored.sound = source.sound;

    if (isRecord(source.categories)) {
        const categories: Record<string, boolean> = {};
        for (const [id, value] of Object.entries(source.categories)) {
            if (typeof value === 'boolean' && CATEGORY_ID_PATTERN.test(id)) categories[id] = value;
        }
        stored.categories = categories;
    }

    if (isRecord(source.quietHours)) {
        const quiet = source.quietHours;
        const quietHours: Partial<QuietHours> = {};
        if (typeof quiet.enabled === 'boolean') quietHours.enabled = quiet.enabled;
        if (isValidTime(quiet.start)) quietHours.start = quiet.start;
        if (isValidTime(quiet.end)) quietHours.end = quiet.end;
        if (isValidTimeZone(quiet.timeZone)) quietHours.timeZone = quiet.timeZone;
        stored.quietHours = quietHours;
    }

    return stored;
}

/**
 * Turns the stored choices into the settings that apply, under `config`:
 *   - a choice the person never made takes the configured default;
 *   - a control the admin hid (config.settings.controls) is locked to its default, whatever was stored;
 *   - sound is off for everybody while the configuration's sound is off;
 *   - a section the admin made mandatory is on; a new section starts at its own default.
 * Never throws, so a damaged document can never stop a notification or crash the settings screen.
 */
export function normalizeSettings(raw: unknown, config: NotificationConfig = DEFAULT_NOTIFICATION_CONFIG): NotificationSettings {
    const stored = pickStoredSettings(raw);
    const { controls, defaults } = config.settings;

    return {
        enabled: stored.enabled ?? defaults.enabled,
        popups: controls.popups ? (stored.popups ?? defaults.popups) : defaults.popups,
        sound: config.sound.enabled && (controls.sound ? (stored.sound ?? defaults.sound) : defaults.sound),
        categories: Object.fromEntries(
            config.categories.map((category) => [
                category.id,
                category.userCanMute ? (ownValue(stored.categories as Record<string, boolean> | undefined, category.id) ?? category.defaultEnabled) : true,
            ])
        ),
        quietHours: controls.quietHours ? { ...defaults.quietHours, ...stored.quietHours } : { ...defaults.quietHours },
    };
}

/** What applies to a person who has chosen nothing, under the built-in configuration. */
export const DEFAULT_SETTINGS: NotificationSettings = normalizeSettings({}, DEFAULT_NOTIFICATION_CONFIG);

/** `settings` with `patch` applied on top (nested groups merge field by field), resolved under `config`. */
export function applySettingsPatch(
    settings: NotificationSettings,
    patch: NotificationSettingsPatch,
    config: NotificationConfig = DEFAULT_NOTIFICATION_CONFIG
): NotificationSettings {
    return normalizeSettings(mergePatches(settings, patch), config);
}

/** Combines two patches into one that has the same effect as applying `first` then `second`. */
export function mergePatches(first: NotificationSettingsPatch, second: NotificationSettingsPatch): NotificationSettingsPatch {
    const merged: NotificationSettingsPatch = { ...first, ...second };
    if (first.categories || second.categories) merged.categories = { ...first.categories, ...second.categories };
    if (first.quietHours || second.quietHours) merged.quietHours = { ...first.quietHours, ...second.quietHours };
    return merged;
}
