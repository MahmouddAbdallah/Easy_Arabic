/**
 * Notification CONFIGURATION — what the notification system offers and how it behaves by default. An admin
 * edits it in the dashboard (components/notification/dashboard); it is stored as ONE Firestore document
 * (`notificationConfig/main`, see contract.ts) and shared by:
 *   - the server, which enforces it when sending (sendNotification: sections, per-type delivery, default icon,
 *     whether pushes may make a sound) and uses its defaults for users who never chose anything;
 *   - the browser, which draws the settings screen from it and uses it for pop-ups and sound;
 *   - the dashboard, which edits it.
 * No server or browser imports and no zod, so it is safe to bundle anywhere. Reading and validating a stored or
 * submitted value is configParse.ts.
 *
 * ── Configuration is not settings ────────────────────────────────────────────────────────────────────────
 *   config   (this file)   ONE for the whole system. Set by an admin. Says which sections exist, which controls
 *                          users get, what the defaults are, how the chime sounds.
 *   settings (settings.ts) ONE PER USER. What a person chose WITHIN what the configuration offers.
 * The configuration never overwrites a user's stored choices: it only decides which of them apply (a control
 * that is switched off for everyone is locked to its default; a section that is switched off alerts nobody)
 * and what a user who chose nothing gets. Change the configuration back and their choices are still there.
 *
 * ── Defaults ───────────────────────────────────────────────────────────────────────────────────────────────
 * DEFAULT_NOTIFICATION_CONFIG is exactly what used to be hard-coded (the four sections, the two-note chime,
 * 6-second pop-ups, per-type urgency and time-to-live from NOTIFICATION_TYPE_CONFIG). While no configuration
 * document exists it is what applies, so nothing changes until an admin saves one.
 */
import {
    NOTIFICATION_CATEGORIES,
    NOTIFICATION_TYPES,
    NOTIFICATION_TYPE_CONFIG,
    type NotificationCategory,
    type NotificationType,
    type PushUrgency,
} from './contract';
import type { QuietHours } from './time';

// ─── Vocabulary ───────────────────────────────────────────────────────────────

export const CONFIG_VERSION = 1;

/** A category id is permanent (users' choices are stored under it): lowercase, starts with a letter. */
export const CATEGORY_ID_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
/** Valid by the pattern, but they would collide with built-in object properties. */
export const RESERVED_CATEGORY_IDS: readonly string[] = ['constructor', 'prototype', 'hasownproperty', 'tostring', 'valueof'];

/**
 * The icons a section can use. Configuration is data, so it names an icon; categoryIcons.ts maps each name to
 * the component (and the compiler forces the two lists to stay equal).
 */
export const CATEGORY_ICON_NAMES = [
    'bell',
    'message-circle',
    'book-open',
    'user-round',
    'megaphone',
    'shield-check',
    'calendar',
    'credit-card',
    'star',
    'gift',
    'graduation-cap',
    'clock',
    'heart',
    'info',
    'mail',
    'award',
    'users',
    'file-text',
    'tag',
    'triangle-alert',
] as const;
export type CategoryIconName = (typeof CATEGORY_ICON_NAMES)[number];

export const SOUND_TONES = ['sine', 'triangle', 'square', 'sawtooth'] as const;
export type SoundTone = (typeof SOUND_TONES)[number];

export const PUSH_URGENCIES: readonly PushUrgency[] = ['very-low', 'low', 'normal', 'high'];

/** Bounds shared by the parser, the dashboard's inputs and its hints, so they can never disagree. */
export const CONFIG_LIMITS = {
    categories: { max: 20, title: 40, description: 120 },
    sound: { maxNotes: 6, minHz: 100, maxHz: 4000, maxDelayMs: 2000, minNoteMs: 80, maxNoteMs: 2000, maxGapMs: 60_000, maxUrl: 500 },
    popup: { minMs: 1000, maxMs: 30_000 },
    /** FCM's own maximum time-to-live. */
    ttlSeconds: { max: 28 * 24 * 60 * 60 },
    copy: { title: 60, hint: 160 },
    assetUrl: 500,
} as const;

// ─── Shape ────────────────────────────────────────────────────────────────────

/** One section of "What to be notified about". */
export interface CategoryConfig {
    /** Permanent. Users' choices are stored under it (CATEGORY_ID_PATTERN). */
    id: NotificationCategory;
    /** What the user sees. */
    title: string;
    description: string;
    icon: CategoryIconName;
    /**
     * false = the section is switched off for everyone: it disappears from the settings screen and its
     * notifications raise no alert (push, pop-up or sound). They are still stored in the in-app list, exactly
     * like a muted section — the list is the record, alerts are the preference.
     */
    enabled: boolean;
    /** Whether it is on for a user who never chose. */
    defaultEnabled: boolean;
    /** false = always on: the user sees the section but cannot turn it off (e.g. security notices). */
    userCanMute: boolean;
}

export interface ToneNote {
    /** Hz. */
    frequency: number;
    /** Milliseconds after the start of the chime. */
    delayMs: number;
}

export interface SoundConfig {
    /**
     * Master switch. false = nothing makes a sound: no in-app chime, every push is silent, and the "Sound" setting
     * disappears from the settings screen.
     */
    enabled: boolean;
    /** 0–100. Maps to the chime's gain or the audio file's volume (see chimeGain). */
    volume: number;
    tone: SoundTone;
    /** The chime: these notes, in order, each starting `delayMs` after the first. */
    notes: ToneNote[];
    /** How long each note rings. */
    noteDurationMs: number;
    /** At most one sound per this many milliseconds, however many notifications arrive. */
    minGapMs: number;
    /** With several tabs open, play in only one of them per notification (needs Web Locks; otherwise all play). */
    onePerAlertAcrossTabs: boolean;
    /** An audio file to play instead of the synthesised chime: an internal path or an https URL. */
    customUrl: string | null;
}

export interface SettingsControls {
    popups: boolean;
    sound: boolean;
    /** The "Push on this device" block of the settings screen. */
    push: boolean;
    quietHours: boolean;
}

export interface SettingsDefaults {
    /** The master switch of a user who never chose. */
    enabled: boolean;
    popups: boolean;
    sound: boolean;
    quietHours: QuietHours;
}

/** How one notification type is delivered. Starts from NOTIFICATION_TYPE_CONFIG (identity stays code-only). */
export interface TypeDelivery {
    /** Which section a notification of this type belongs to (an id in `categories`). */
    category: NotificationCategory;
    urgency: PushUrgency;
    /** How long FCM keeps the message for an offline device. */
    ttlSeconds: number;
}

export interface NotificationConfig {
    version: typeof CONFIG_VERSION;
    /**
     * Increases by one with every save; 0 while nothing was ever saved. A save must name the revision it was
     * based on, so two admins cannot silently overwrite each other. Set by the server — ignored on input.
     */
    revision: number;
    /** Epoch milliseconds of the last save, `null` before the first. Set by the server — ignored on input. */
    updatedAt: number | null;

    sound: SoundConfig;
    settings: {
        /** Which settings users get to change. A hidden control is locked to its default for everyone. */
        controls: SettingsControls;
        /** What users who never chose get. */
        defaults: SettingsDefaults;
    };
    /** The sections of "What to be notified about", in the order users see them. At least one. */
    categories: CategoryConfig[];
    /** Where a notification goes when its type's section is gone: an id in `categories`. */
    fallbackCategory: NotificationCategory;
    /** One entry per notification type, always complete. */
    types: Record<NotificationType, TypeDelivery>;
    delivery: {
        /** How long an in-app pop-up stays. */
        popupDurationMs: number;
        /** The icon of a system notification whose sender gave none: an internal path or https URL, or null for the app's own. */
        defaultIcon: string | null;
    };
    /** The wording of the settings screen's category block. */
    copy: {
        categoriesTitle: string;
        categoriesHint: string;
    };
}

// ─── Built-in defaults ────────────────────────────────────────────────────────

export const DEFAULT_QUIET_HOURS: QuietHours = { enabled: false, start: '22:00', end: '07:00', timeZone: 'UTC' };

/** What the settings screen used to hard-code. */
const BUILT_IN_CATEGORIES: Record<(typeof NOTIFICATION_CATEGORIES)[number], Pick<CategoryConfig, 'title' | 'description' | 'icon'>> = {
    messages: { title: 'Messages', description: 'New chat messages.', icon: 'message-circle' },
    lessons: { title: 'Lessons', description: 'Lesson updates and reminders.', icon: 'book-open' },
    account: { title: 'Account activity', description: 'Sign-ins and account changes.', icon: 'user-round' },
    general: { title: 'Announcements', description: 'News and everything else.', icon: 'megaphone' },
};

export const DEFAULT_SOUND_CONFIG: SoundConfig = {
    enabled: true,
    // 40 % is the chime's original gain: see chimeGain.
    volume: 40,
    tone: 'sine',
    // E5 then A5.
    notes: [
        { frequency: 659.25, delayMs: 0 },
        { frequency: 880, delayMs: 130 },
    ],
    noteDurationMs: 420,
    minGapMs: 1500,
    onePerAlertAcrossTabs: true,
    customUrl: null,
};

/** Loudest chime gain (volume 100). The original chime was 0.16, which is volume 40. */
export const MAX_CHIME_GAIN = 0.4;

// Multiply first: 40 * 0.4 / 100 is exactly 0.16, while (40 / 100) * 0.4 is off by one part in 10^16.
export const chimeGain = (volume: number): number => (Math.min(100, Math.max(0, volume)) * MAX_CHIME_GAIN) / 100;

export const DEFAULT_TYPE_DELIVERY = Object.fromEntries(
    NOTIFICATION_TYPES.map((type) => {
        const { category, urgency, ttlSeconds } = NOTIFICATION_TYPE_CONFIG[type];
        return [type, { category, urgency, ttlSeconds }];
    })
) as Record<NotificationType, TypeDelivery>;

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
    version: CONFIG_VERSION,
    revision: 0,
    updatedAt: null,
    sound: DEFAULT_SOUND_CONFIG,
    settings: {
        controls: { popups: true, sound: true, push: true, quietHours: true },
        defaults: { enabled: true, popups: true, sound: true, quietHours: DEFAULT_QUIET_HOURS },
    },
    categories: NOTIFICATION_CATEGORIES.map((id) => ({
        id,
        ...BUILT_IN_CATEGORIES[id],
        enabled: true,
        defaultEnabled: true,
        userCanMute: true,
    })),
    fallbackCategory: 'general',
    types: DEFAULT_TYPE_DELIVERY,
    delivery: { popupDurationMs: 6000, defaultIcon: null },
    copy: {
        categoriesTitle: 'What to be notified about',
        categoriesHint: 'Muted kinds still appear in your list, without an alert.',
    },
};

// ─── Lookups ──────────────────────────────────────────────────────────────────

/** Own-property read, so a category called "constructor" can never find Object's. */
export function ownValue<T>(record: Readonly<Record<string, T>> | undefined, key: string): T | undefined {
    return record && Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

export const findCategory = (config: NotificationConfig, id: NotificationCategory): CategoryConfig | undefined =>
    config.categories.find((category) => category.id === id);

/** The sections users can see and (unless `userCanMute` is false) switch. */
export const visibleCategories = (config: NotificationConfig): CategoryConfig[] => config.categories.filter((category) => category.enabled);

/** How `type` is delivered under `config`. Always defined: the configuration holds every type. */
export const typeDelivery = (config: NotificationConfig, type: NotificationType): TypeDelivery => config.types[type] ?? DEFAULT_TYPE_DELIVERY[type];

/**
 * The section a notification of `type` belongs to: the one its type is routed to or, when that section no
 * longer exists, the fallback. `undefined` only for a configuration that has no usable section at all, which
 * parseConfig never produces — callers then simply apply no section rule.
 */
export function categoryOfType(config: NotificationConfig, type: NotificationType): CategoryConfig | undefined {
    return findCategory(config, typeDelivery(config, type).category) ?? findCategory(config, config.fallbackCategory);
}
