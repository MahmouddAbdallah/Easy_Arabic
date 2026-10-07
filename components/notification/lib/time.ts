/**
 * Clock helpers shared by the two layers that talk about quiet hours: settings.ts (what ONE user chose) and
 * config.ts (what the admin offers and defaults to). They live here, with no imports, so neither of those
 * has to import the other. settings.ts re-exports them, so existing imports keep working.
 */

export interface QuietHours {
    enabled: boolean;
    /** "HH:mm", 24-hour. */
    start: string;
    /** "HH:mm", 24-hour. A window that ends before it starts runs overnight (22:00 → 07:00). */
    end: string;
    /** IANA time zone, e.g. "Africa/Cairo". */
    timeZone: string;
}

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
