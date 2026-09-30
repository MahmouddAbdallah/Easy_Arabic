/**
 * Reaction config + pure helpers. Safe to import from both client and server code.
 *
 * Storage model (one map per message document):
 *   reactions: { [userId]: ReactionKey }
 * A map key can only hold one value, so "one reaction per user per message" is
 * enforced by the data shape itself, and counts are a single pass over the values.
 *
 * To add a reaction: add a key to REACTION_KEYS and an entry to REACTION_META.
 */
export const REACTION_KEYS = ["like", "heart", "sad", "fire", "angry"] as const;

export type ReactionKey = (typeof REACTION_KEYS)[number];

/** userId -> the reaction that user currently has on the message. */
export type ReactionMap = Record<string, ReactionKey>;

export const REACTION_META: Record<ReactionKey, { emoji: string; label: string }> = {
    like: { emoji: "👍", label: "Like" },
    heart: { emoji: "❤️", label: "Heart" },
    sad: { emoji: "😢", label: "Sad" },
    fire: { emoji: "🔥", label: "Fire" },
    angry: { emoji: "😡", label: "Angry" },
};

export function isReactionKey(value: unknown): value is ReactionKey {
    return typeof value === "string" && (REACTION_KEYS as readonly string[]).includes(value);
}

/** Firestore data is untyped; drop anything that isn't a known reaction. */
export function normalizeReactions(raw: unknown): ReactionMap {
    if (!raw || typeof raw !== "object") return {};
    const result: ReactionMap = {};
    for (const [userId, value] of Object.entries(raw as Record<string, unknown>)) {
        if (isReactionKey(value)) result[userId] = value;
    }
    return result;
}

export interface ReactionSummaryItem {
    key: ReactionKey;
    emoji: string;
    label: string;
    count: number;
    userIds: string[];
    reactedByMe: boolean;
}

/** Counts per reaction, in the fixed REACTION_KEYS order (keeps chips from jumping around). */
export function summarizeReactions(
    reactions: ReactionMap,
    currentUserId?: string
): ReactionSummaryItem[] {
    const buckets = new Map<ReactionKey, string[]>();
    for (const [userId, key] of Object.entries(reactions)) {
        const list = buckets.get(key);
        if (list) list.push(userId);
        else buckets.set(key, [userId]);
    }

    return REACTION_KEYS.flatMap((key) => {
        const userIds = buckets.get(key);
        if (!userIds?.length) return [];
        return [
            {
                key,
                ...REACTION_META[key],
                count: userIds.length,
                userIds,
                reactedByMe: !!currentUserId && userIds.includes(currentUserId),
            },
        ];
    });
}
