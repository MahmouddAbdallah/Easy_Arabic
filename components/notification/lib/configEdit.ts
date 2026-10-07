/**
 * Edits to a NotificationConfig draft, as pure functions: each takes a configuration and returns a new one, never
 * mutating its input. The dashboard (components/notification/dashboard) is built on these, which keeps the rules of
 * editing in one testable place and the components free of logic.
 *
 * The edits that touch more than one field are the reason this exists. A section is referenced from three places —
 * the list itself, `fallbackCategory`, and every type's route — so adding, renaming or removing one has to keep all
 * of them pointing at sections that exist (parseConfig refuses a configuration where they do not).
 */
import {
    CATEGORY_ID_PATTERN,
    CONFIG_LIMITS,
    DEFAULT_NOTIFICATION_CONFIG,
    DEFAULT_SOUND_CONFIG,
    RESERVED_CATEGORY_IDS,
    type CategoryConfig,
    type NotificationConfig,
    type ToneNote,
    type TypeDelivery,
} from './config';
import { NOTIFICATION_TYPES, type NotificationCategory, type NotificationType } from './contract';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// ─── Section ids ──────────────────────────────────────────────────────────────

const MAX_ID_LENGTH = 32;

/**
 * A valid, unused section id for `text`: "Payment reminders" → "payment-reminders". Text with no Latin letters or
 * digits (Arabic, say) cannot be spelled out, so it becomes "section". Taken ids get "-2", "-3"….
 */
export function suggestCategoryId(text: string, taken: ReadonlySet<string>): string {
    let base = text
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    if (!/^[a-z]/.test(base)) base = base ? `section-${base}` : 'section';
    base = base.slice(0, MAX_ID_LENGTH - 3).replace(/-+$/, '') || 'section';

    const isFree = (id: string) => !taken.has(id) && !RESERVED_CATEGORY_IDS.includes(id);
    if (isFree(base)) return base;
    for (let n = 2; n < 1000; n += 1) {
        const id = `${base}-${n}`;
        if (isFree(id)) return id;
    }
    return `${base}-${Date.now().toString(36)}`.slice(0, MAX_ID_LENGTH);
}

/** Why `id` cannot be used for a section, or `undefined` if it can. `others` are the ids of the other sections. */
export function categoryIdProblem(id: string, others: ReadonlySet<string>): string | undefined {
    if (!CATEGORY_ID_PATTERN.test(id) || RESERVED_CATEGORY_IDS.includes(id)) {
        return 'Start with a lowercase letter; use only lowercase letters, digits, "-" and "_" (up to 32).';
    }
    if (others.has(id)) return 'Another section already uses this id.';
    return undefined;
}

// ─── Sections ─────────────────────────────────────────────────────────────────

export const canAddCategory = (config: NotificationConfig): boolean => config.categories.length < CONFIG_LIMITS.categories.max;

/** Appends a new, switched-on section and returns it with the new configuration. */
export function addCategory(config: NotificationConfig): { config: NotificationConfig; id: NotificationCategory } {
    const id = suggestCategoryId('New section', new Set(config.categories.map((category) => category.id)));
    const category: CategoryConfig = {
        id,
        title: 'New section',
        description: '',
        icon: 'bell',
        enabled: true,
        defaultEnabled: true,
        userCanMute: true,
    };
    return { config: { ...config, categories: [...config.categories, category] }, id };
}

export function updateCategory(config: NotificationConfig, id: NotificationCategory, patch: Partial<Omit<CategoryConfig, 'id'>>): NotificationConfig {
    return { ...config, categories: config.categories.map((category) => (category.id === id ? { ...category, ...patch } : category)) };
}

/** Changes a section's id everywhere it is referenced. Only meant for a section that was never saved: users' choices hang on saved ids. */
export function renameCategoryId(config: NotificationConfig, from: NotificationCategory, to: NotificationCategory): NotificationConfig {
    if (from === to) return config;
    const route = (id: NotificationCategory) => (id === from ? to : id);
    return {
        ...config,
        categories: config.categories.map((category) => (category.id === from ? { ...category, id: to } : category)),
        fallbackCategory: route(config.fallbackCategory),
        types: Object.fromEntries(NOTIFICATION_TYPES.map((type) => [type, { ...config.types[type], category: route(config.types[type].category) }])) as Record<NotificationType, TypeDelivery>,
    };
}

/** Moves a section up (`-1`) or down (`1`) in the order users see. */
export function moveCategory(config: NotificationConfig, id: NotificationCategory, delta: -1 | 1): NotificationConfig {
    const from = config.categories.findIndex((category) => category.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= config.categories.length) return config;

    const categories = [...config.categories];
    [categories[from], categories[to]] = [categories[to], categories[from]];
    return { ...config, categories };
}

/** Which notification types are routed to `id` — what removing it would move to the fallback. */
export const typesRoutedTo = (config: NotificationConfig, id: NotificationCategory): NotificationType[] =>
    NOTIFICATION_TYPES.filter((type) => config.types[type].category === id);

/**
 * Removes a section. Its types are routed to the fallback section instead; if the removed one WAS the fallback, the
 * first section left becomes the fallback. The last remaining section cannot be removed (the system needs somewhere
 * to route notifications): the configuration comes back unchanged.
 */
export function removeCategory(config: NotificationConfig, id: NotificationCategory): NotificationConfig {
    const remaining = config.categories.filter((category) => category.id !== id);
    if (remaining.length === 0 || remaining.length === config.categories.length) return config;

    const fallbackCategory = config.fallbackCategory === id ? remaining[0].id : config.fallbackCategory;
    return {
        ...config,
        categories: remaining,
        fallbackCategory,
        types: Object.fromEntries(
            NOTIFICATION_TYPES.map((type) => [type, config.types[type].category === id ? { ...config.types[type], category: fallbackCategory } : config.types[type]])
        ) as Record<NotificationType, TypeDelivery>,
    };
}

// ─── Types, sound ─────────────────────────────────────────────────────────────

export function updateTypeDelivery(config: NotificationConfig, type: NotificationType, patch: Partial<TypeDelivery>): NotificationConfig {
    return { ...config, types: { ...config.types, [type]: { ...config.types[type], ...patch } } };
}

export const canAddNote = (config: NotificationConfig): boolean => config.sound.notes.length < CONFIG_LIMITS.sound.maxNotes;

export function addNote(config: NotificationConfig): NotificationConfig {
    const last = config.sound.notes.at(-1);
    const note: ToneNote = { frequency: 880, delayMs: Math.min(CONFIG_LIMITS.sound.maxDelayMs, (last?.delayMs ?? 0) + 130) };
    return { ...config, sound: { ...config.sound, notes: [...config.sound.notes, note] } };
}

export function updateNote(config: NotificationConfig, index: number, patch: Partial<ToneNote>): NotificationConfig {
    return { ...config, sound: { ...config.sound, notes: config.sound.notes.map((note, i) => (i === index ? { ...note, ...patch } : note)) } };
}

/** Removes a note; the last one cannot be removed (a chime needs at least one). */
export function removeNote(config: NotificationConfig, index: number): NotificationConfig {
    if (config.sound.notes.length <= 1) return config;
    return { ...config, sound: { ...config.sound, notes: config.sound.notes.filter((_, i) => i !== index) } };
}

export const resetSound = (config: NotificationConfig): NotificationConfig => ({ ...config, sound: clone(DEFAULT_SOUND_CONFIG) });

// ─── Whole configuration ──────────────────────────────────────────────────────

/** The built-in defaults as an editable draft, keeping `current`'s revision so saving it is still a valid, non-conflicting update. */
export function builtInDraft(current: Pick<NotificationConfig, 'revision' | 'updatedAt'>): NotificationConfig {
    return { ...clone(DEFAULT_NOTIFICATION_CONFIG), revision: current.revision, updatedAt: current.updatedAt };
}

/** Do two configurations hold the same values? (Revision and save time are the server's and do not count.) */
export function sameConfig(a: NotificationConfig, b: NotificationConfig): boolean {
    const strip = ({ revision: _r, updatedAt: _u, ...rest }: NotificationConfig) => (void _r, void _u, JSON.stringify(rest));
    return strip(a) === strip(b);
}
