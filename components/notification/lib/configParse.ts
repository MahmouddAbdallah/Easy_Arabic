/**
 * Turning an unknown value — the stored document, an API response, a submitted form — into a valid
 * NotificationConfig. ONE walker does both jobs, so the rules can never differ between them:
 *
 *   parseConfig(raw).config   always a valid configuration. Anything missing or invalid falls back to its default
 *                             (numbers are clamped, an unusable section is dropped). It never throws, so a damaged
 *                             document can never stop a notification or crash the settings screen. This is what
 *                             READING uses (the server before sending, the browser before rendering).
 *   parseConfig(raw).issues   what was wrong, with the path of each problem ("categories.2.title"). Empty means
 *                             `raw` was valid as it stands. This is what SAVING uses (the API refuses a
 *                             configuration with issues) and what the dashboard shows next to its fields.
 *
 * A field that is simply absent is not an issue — it takes its default — but one of the wrong type, out of range
 * or unknown is. No zod: the browser bundle uses this too (see schema.ts for the API's request bodies).
 */
import {
    CATEGORY_ICON_NAMES,
    CATEGORY_ID_PATTERN,
    CONFIG_LIMITS,
    CONFIG_VERSION,
    DEFAULT_NOTIFICATION_CONFIG,
    DEFAULT_QUIET_HOURS,
    DEFAULT_SOUND_CONFIG,
    PUSH_URGENCIES,
    RESERVED_CATEGORY_IDS,
    SOUND_TONES,
    type CategoryConfig,
    type NotificationConfig,
    type SettingsControls,
    type SettingsDefaults,
    type SoundConfig,
    type ToneNote,
    type TypeDelivery,
} from './config';
import { NOTIFICATION_TYPES, isSafeAssetUrl, type NotificationType } from './contract';
import { isValidTime, isValidTimeZone } from './time';

export interface ConfigIssue {
    /** Dotted path of the field: "sound.notes.1.frequency". */
    path: string;
    message: string;
}

export interface ParsedConfig {
    config: NotificationConfig;
    issues: ConfigIssue[];
}

type Path = readonly (string | number)[];
type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw | undefined =>
    typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Raw) : undefined;

class Reader {
    readonly issues: ConfigIssue[] = [];

    add(path: Path, message: string) {
        this.issues.push({ path: path.join('.'), message });
    }

    /** An object (or nothing, which means "all defaults"). Reports keys we do not know. */
    object(value: unknown, path: Path, allowed: readonly string[]): Raw {
        if (value === undefined) return {};
        const record = asRecord(value);
        if (!record) {
            this.add(path, 'must be an object');
            return {};
        }
        for (const key of Object.keys(record)) {
            if (!allowed.includes(key)) this.add([...path, key], 'is not a known setting');
        }
        return record;
    }

    bool(value: unknown, fallback: boolean, path: Path): boolean {
        if (value === undefined) return fallback;
        if (typeof value === 'boolean') return value;
        this.add(path, 'must be on or off');
        return fallback;
    }

    number(value: unknown, fallback: number, path: Path, { min, max, integer = false }: { min: number; max: number; integer?: boolean }): number {
        if (value === undefined) return fallback;
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            this.add(path, 'must be a number');
            return fallback;
        }
        if (integer && !Number.isInteger(value)) this.add(path, 'must be a whole number');
        if (value < min || value > max) this.add(path, `must be between ${min} and ${max}`);
        const clamped = Math.min(max, Math.max(min, value));
        return integer ? Math.round(clamped) : clamped;
    }

    text(value: unknown, fallback: string, path: Path, { min = 0, max }: { min?: number; max: number }): string {
        if (value === undefined) return fallback;
        if (typeof value !== 'string') {
            this.add(path, 'must be text');
            return fallback;
        }
        const trimmed = value.trim();
        if (trimmed.length < min) {
            this.add(path, min === 1 ? 'is required' : `must be at least ${min} characters`);
            return fallback;
        }
        if (trimmed.length > max) {
            this.add(path, `must be at most ${max} characters`);
            return trimmed.slice(0, max);
        }
        return trimmed;
    }

    oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T, path: Path): T {
        if (value === undefined) return fallback;
        if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
        this.add(path, `must be one of: ${allowed.join(', ')}`);
        return fallback;
    }

    /** An internal path or an https URL, `null`/empty for "none". */
    assetUrl(value: unknown, fallback: string | null, path: Path): string | null {
        if (value === undefined) return fallback;
        if (value === null || (typeof value === 'string' && value.trim() === '')) return null;
        if (typeof value === 'string' && isSafeAssetUrl(value.trim()) && value.trim().length <= CONFIG_LIMITS.assetUrl) return value.trim();
        this.add(path, 'must be an internal path starting with "/" or an https:// URL');
        return fallback;
    }

    list(value: unknown, path: Path): unknown[] | undefined {
        if (value === undefined) return undefined;
        if (Array.isArray(value)) return value;
        this.add(path, 'must be a list');
        return undefined;
    }
}

// ─── Parts ────────────────────────────────────────────────────────────────────

function readNotes(r: Reader, value: unknown, path: Path): ToneNote[] {
    const list = r.list(value, path);
    if (!list) return DEFAULT_SOUND_CONFIG.notes.map((note) => ({ ...note }));

    const { maxNotes, minHz, maxHz, maxDelayMs } = CONFIG_LIMITS.sound;
    if (list.length === 0) r.add(path, 'needs at least one note');
    if (list.length > maxNotes) r.add(path, `can have at most ${maxNotes} notes`);

    const notes = list.slice(0, maxNotes).map((item, index): ToneNote => {
        const at = [...path, index];
        const note = r.object(item, at, ['frequency', 'delayMs']);
        return {
            frequency: r.number(note.frequency, 880, [...at, 'frequency'], { min: minHz, max: maxHz }),
            delayMs: r.number(note.delayMs, 0, [...at, 'delayMs'], { min: 0, max: maxDelayMs, integer: true }),
        };
    });
    return notes.length > 0 ? notes : DEFAULT_SOUND_CONFIG.notes.map((note) => ({ ...note }));
}

function readSound(r: Reader, value: unknown, path: Path): SoundConfig {
    const d = DEFAULT_SOUND_CONFIG;
    const s = CONFIG_LIMITS.sound;
    const raw = r.object(value, path, ['enabled', 'volume', 'tone', 'notes', 'noteDurationMs', 'minGapMs', 'onePerAlertAcrossTabs', 'customUrl']);
    return {
        enabled: r.bool(raw.enabled, d.enabled, [...path, 'enabled']),
        volume: r.number(raw.volume, d.volume, [...path, 'volume'], { min: 0, max: 100, integer: true }),
        tone: r.oneOf(raw.tone, SOUND_TONES, d.tone, [...path, 'tone']),
        notes: readNotes(r, raw.notes, [...path, 'notes']),
        noteDurationMs: r.number(raw.noteDurationMs, d.noteDurationMs, [...path, 'noteDurationMs'], { min: s.minNoteMs, max: s.maxNoteMs, integer: true }),
        minGapMs: r.number(raw.minGapMs, d.minGapMs, [...path, 'minGapMs'], { min: 0, max: s.maxGapMs, integer: true }),
        onePerAlertAcrossTabs: r.bool(raw.onePerAlertAcrossTabs, d.onePerAlertAcrossTabs, [...path, 'onePerAlertAcrossTabs']),
        customUrl: r.assetUrl(raw.customUrl, d.customUrl, [...path, 'customUrl']),
    };
}

function readQuietHours(r: Reader, value: unknown, path: Path): SettingsDefaults['quietHours'] {
    const raw = r.object(value, path, ['enabled', 'start', 'end', 'timeZone']);
    const time = (v: unknown, fallback: string, at: Path) => {
        if (v === undefined) return fallback;
        if (isValidTime(v)) return v;
        r.add(at, 'must be a 24-hour time such as "22:00"');
        return fallback;
    };
    const zone = raw.timeZone;
    return {
        enabled: r.bool(raw.enabled, DEFAULT_QUIET_HOURS.enabled, [...path, 'enabled']),
        start: time(raw.start, DEFAULT_QUIET_HOURS.start, [...path, 'start']),
        end: time(raw.end, DEFAULT_QUIET_HOURS.end, [...path, 'end']),
        timeZone:
            zone === undefined ? DEFAULT_QUIET_HOURS.timeZone : isValidTimeZone(zone) ? zone : (r.add([...path, 'timeZone'], 'is not a known time zone'), DEFAULT_QUIET_HOURS.timeZone),
    };
}

function readSettings(r: Reader, value: unknown, path: Path): NotificationConfig['settings'] {
    const d = DEFAULT_NOTIFICATION_CONFIG.settings;
    const raw = r.object(value, path, ['controls', 'defaults']);

    const controlsPath = [...path, 'controls'];
    const controls = r.object(raw.controls, controlsPath, ['popups', 'sound', 'push', 'quietHours']);
    const defaultsPath = [...path, 'defaults'];
    const defaults = r.object(raw.defaults, defaultsPath, ['enabled', 'popups', 'sound', 'quietHours']);

    return {
        controls: {
            popups: r.bool(controls.popups, d.controls.popups, [...controlsPath, 'popups']),
            sound: r.bool(controls.sound, d.controls.sound, [...controlsPath, 'sound']),
            push: r.bool(controls.push, d.controls.push, [...controlsPath, 'push']),
            quietHours: r.bool(controls.quietHours, d.controls.quietHours, [...controlsPath, 'quietHours']),
        } satisfies SettingsControls,
        defaults: {
            enabled: r.bool(defaults.enabled, d.defaults.enabled, [...defaultsPath, 'enabled']),
            popups: r.bool(defaults.popups, d.defaults.popups, [...defaultsPath, 'popups']),
            sound: r.bool(defaults.sound, d.defaults.sound, [...defaultsPath, 'sound']),
            quietHours: readQuietHours(r, defaults.quietHours, [...defaultsPath, 'quietHours']),
        },
    };
}

function readCategories(r: Reader, value: unknown, path: Path): CategoryConfig[] {
    const list = r.list(value, path);
    if (!list) return DEFAULT_NOTIFICATION_CONFIG.categories.map((category) => ({ ...category }));

    const { max, title, description } = CONFIG_LIMITS.categories;
    if (list.length > max) r.add(path, `can have at most ${max} sections`);

    const seen = new Set<string>();
    const categories: CategoryConfig[] = [];

    list.slice(0, max).forEach((item, index) => {
        const at = [...path, index];
        const raw = r.object(item, at, ['id', 'title', 'description', 'icon', 'enabled', 'defaultEnabled', 'userCanMute']);

        const id = raw.id;
        if (typeof id !== 'string' || !CATEGORY_ID_PATTERN.test(id) || RESERVED_CATEGORY_IDS.includes(id)) {
            // An id cannot be repaired — users' choices hang on it — so the section is dropped.
            r.add([...at, 'id'], 'must start with a lowercase letter and use only lowercase letters, digits, "-" and "_" (up to 32)');
            return;
        }
        if (seen.has(id)) {
            r.add([...at, 'id'], `"${id}" is used by another section`);
            return;
        }
        seen.add(id);

        categories.push({
            id,
            title: r.text(raw.title, id, [...at, 'title'], { min: 1, max: title }),
            description: r.text(raw.description, '', [...at, 'description'], { max: description }),
            icon: r.oneOf(raw.icon, CATEGORY_ICON_NAMES, 'bell', [...at, 'icon']),
            enabled: r.bool(raw.enabled, true, [...at, 'enabled']),
            defaultEnabled: r.bool(raw.defaultEnabled, true, [...at, 'defaultEnabled']),
            userCanMute: r.bool(raw.userCanMute, true, [...at, 'userCanMute']),
        });
    });

    if (categories.length === 0) {
        r.add(path, 'needs at least one section');
        return DEFAULT_NOTIFICATION_CONFIG.categories.map((category) => ({ ...category }));
    }
    return categories;
}

function readTypes(r: Reader, value: unknown, path: Path, categoryIds: Set<string>, fallback: string): Record<NotificationType, TypeDelivery> {
    const raw = r.object(value, path, NOTIFICATION_TYPES);

    return Object.fromEntries(
        NOTIFICATION_TYPES.map((type) => {
            const d = DEFAULT_NOTIFICATION_CONFIG.types[type];
            const at = [...path, type];
            const entry = r.object(raw[type], at, ['category', 'urgency', 'ttlSeconds']);

            let category = d.category as string;
            if (entry.category !== undefined) {
                if (typeof entry.category === 'string' && categoryIds.has(entry.category)) category = entry.category;
                else {
                    r.add([...at, 'category'], 'must be one of the sections');
                    category = fallback;
                }
            } else if (!categoryIds.has(category)) {
                // The built-in section this type used to belong to was removed: it follows the fallback.
                category = fallback;
            }

            return [
                type,
                {
                    category,
                    urgency: r.oneOf(entry.urgency, PUSH_URGENCIES, d.urgency, [...at, 'urgency']),
                    ttlSeconds: r.number(entry.ttlSeconds, d.ttlSeconds, [...at, 'ttlSeconds'], { min: 0, max: CONFIG_LIMITS.ttlSeconds.max, integer: true }),
                },
            ];
        })
    ) as Record<NotificationType, TypeDelivery>;
}

// ─── The whole configuration ──────────────────────────────────────────────────

const TOP_LEVEL_KEYS = ['version', 'revision', 'updatedAt', 'sound', 'settings', 'categories', 'fallbackCategory', 'types', 'delivery', 'copy'] as const;

export function parseConfig(input: unknown): ParsedConfig {
    const r = new Reader();
    const d = DEFAULT_NOTIFICATION_CONFIG;
    const raw = r.object(input, [], TOP_LEVEL_KEYS);

    const categories = readCategories(r, raw.categories, ['categories']);
    const ids = new Set(categories.map((category) => category.id));

    // The fallback must be a section that exists. Prefer the stated one, then the built-in default, then the first.
    let fallbackCategory = categories[0].id;
    if (raw.fallbackCategory !== undefined) {
        if (typeof raw.fallbackCategory === 'string' && ids.has(raw.fallbackCategory)) fallbackCategory = raw.fallbackCategory;
        else {
            r.add(['fallbackCategory'], 'must be one of the sections');
            if (ids.has(d.fallbackCategory)) fallbackCategory = d.fallbackCategory;
        }
    } else if (ids.has(d.fallbackCategory)) {
        fallbackCategory = d.fallbackCategory;
    }

    const delivery = r.object(raw.delivery, ['delivery'], ['popupDurationMs', 'defaultIcon']);
    const copy = r.object(raw.copy, ['copy'], ['categoriesTitle', 'categoriesHint']);

    const config: NotificationConfig = {
        version: CONFIG_VERSION,
        revision: typeof raw.revision === 'number' && Number.isInteger(raw.revision) && raw.revision >= 0 ? raw.revision : 0,
        updatedAt: typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : null,
        sound: readSound(r, raw.sound, ['sound']),
        settings: readSettings(r, raw.settings, ['settings']),
        categories,
        fallbackCategory,
        types: readTypes(r, raw.types, ['types'], ids, fallbackCategory),
        delivery: {
            popupDurationMs: r.number(delivery.popupDurationMs, d.delivery.popupDurationMs, ['delivery', 'popupDurationMs'], {
                min: CONFIG_LIMITS.popup.minMs,
                max: CONFIG_LIMITS.popup.maxMs,
                integer: true,
            }),
            defaultIcon: r.assetUrl(delivery.defaultIcon, d.delivery.defaultIcon, ['delivery', 'defaultIcon']),
        },
        copy: {
            categoriesTitle: r.text(copy.categoriesTitle, d.copy.categoriesTitle, ['copy', 'categoriesTitle'], { min: 1, max: CONFIG_LIMITS.copy.title }),
            categoriesHint: r.text(copy.categoriesHint, d.copy.categoriesHint, ['copy', 'categoriesHint'], { max: CONFIG_LIMITS.copy.hint }),
        },
    };

    return { config, issues: r.issues };
}

/** A valid configuration from whatever is stored or received. Never throws. */
export const normalizeConfig = (raw: unknown): NotificationConfig => parseConfig(raw).config;

/** The first few problems as one readable sentence — for an API error message. */
export function formatConfigIssues(issues: ConfigIssue[], limit = 3): string {
    const shown = issues.slice(0, limit).map(({ path, message }) => (path ? `${path} ${message}` : message));
    const more = issues.length > limit ? ` (and ${issues.length - limit} more)` : '';
    return shown.join('; ') + more;
}
