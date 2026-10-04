/**
 * SERVER ONLY — decides which notifications are "the same one".
 *
 * A stored notification is identified by WHO it is for plus WHAT it is about:
 *
 *   key   = sha256 of the notification's identity (below) — travels in the push payload
 *   docId = sha256(userId + key)                          — the Firestore document id
 *
 * Because the document id is derived, not random, storing a notification is an upsert on one known
 * document: no query, no extra index, and two concurrent sends for the same user and notification
 * land on the same document (the transaction in inbox.ts serialises them).
 *
 * What the identity is:
 *   1. The caller's `tag`, when there is one. A tag is the caller saying "these are the same
 *      notification": later ones replace earlier ones, so the stored copy is updated with the latest
 *      title/body/link/data. Example: `chat:${sender.id}` — a new message from the same sender
 *      refreshes one notification instead of adding another.
 *   2. Otherwise what the type says (`identity` in NOTIFICATION_TYPE_CONFIG, contract.ts):
 *      - 'link' (chat_message): type + link. A conversation's link names it, so every new message of
 *        that conversation refreshes one notification even if the caller forgot a tag.
 *      - 'content' (the rest): type, link, title, body and data. Nothing says two different texts belong
 *        together, so only an exact repeat (a retry, "Welcome back" on every sign-in) is the same
 *        notification. Guessing wider would silently overwrite notifications that merely look alike,
 *        which is worse than keeping both.
 *
 * Changing how the identity is built orphans stored notifications from before the change: they keep
 * working, but a new send creates a fresh document instead of updating them.
 */
import { createHash } from 'node:crypto';
import { NOTIFICATION_TYPE_CONFIG, type NotificationType } from '../contract';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

interface IdentityFields {
    type: NotificationType;
    title: string;
    body: string;
    link?: string;
    tag?: string;
    data?: Record<string, string | number | boolean>;
}

/** The notification's identity, as a 64-character hex string (safe in URLs, JSON and document ids). */
export function notificationKey({ tag, type, title, body, link, data }: IdentityFields): string {
    if (tag) return sha256(`tag:${tag}`);
    if (link && NOTIFICATION_TYPE_CONFIG[type].identity === 'link') return sha256(`link:${JSON.stringify([type, link])}`);

    // `data` values are stringified exactly as the push payload does, and sorted so key order is irrelevant.
    const entries = Object.entries(data ?? {})
        .map(([name, value]) => [name, String(value)] as const)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return sha256(`content:${JSON.stringify([type, link ?? null, title, body, entries])}`);
}

/** The Firestore document that holds `key`'s notification for `userId`. */
export function notificationDocId(userId: string, key: string): string {
    return sha256(`${userId}\n${key}`);
}
