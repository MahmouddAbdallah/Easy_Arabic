/**
 * SERVER ONLY — no I/O.
 *
 * Absorbs accidental repeats: the same notification, to the same recipients, sent again within
 * DUPLICATE_WINDOW_MS is dropped before it costs a settings read, a token query, an FCM call or an inbox
 * transaction. That is what a retried request, a double click or a handler that fires twice looks like.
 *
 * It is a per-instance memory, deliberately: it catches the common case (a repeat lands on the same warm
 * instance) for free, and when it misses, nothing breaks — the inbox update is idempotent by identity and
 * the device replaces the notification by tag. Two notifications that merely look alike but mean different
 * things (two chat messages that both say "ok") should carry something that tells them apart, e.g.
 * `data: { messageId }`, which is part of the fingerprint.
 */
import { createHash } from 'node:crypto';

const DUPLICATE_WINDOW_MS = 3_000;
const MAX_REMEMBERED = 10_000;

const recent = new Map<string, number>();

/** A stable fingerprint of "this content to these recipients". */
export function sendFingerprint(parts: {
    recipients: string[];
    type: string;
    title: string;
    body: string;
    link?: string;
    tag?: string;
    data?: Record<string, string | number | boolean>;
}): string {
    const data = Object.entries(parts.data ?? {})
        .map(([name, value]) => [name, String(value)] as const)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const recipients = [...new Set(parts.recipients)].sort();

    return createHash('sha256')
        .update(JSON.stringify([recipients, parts.type, parts.title, parts.body, parts.link ?? null, parts.tag ?? null, data]))
        .digest('hex');
}

/**
 * Was this exact send already made in the last few seconds? If not, it is remembered from now on, so
 * the answer for the next identical call is yes. Call `forgetSend` if the send then fails, so a retry is allowed.
 */
export function isRecentDuplicate(fingerprint: string, now: number = Date.now()): boolean {
    const last = recent.get(fingerprint);
    if (last !== undefined && now - last < DUPLICATE_WINDOW_MS) return true;

    if (recent.size >= MAX_REMEMBERED) {
        for (const [key, at] of recent) if (now - at >= DUPLICATE_WINDOW_MS) recent.delete(key);
        if (recent.size >= MAX_REMEMBERED) recent.clear(); // a flood of distinct sends: forgetting is harmless
    }
    recent.delete(fingerprint); // re-insert so Map order stays oldest-first
    recent.set(fingerprint, now);
    return false;
}

export function forgetSend(fingerprint: string): void {
    recent.delete(fingerprint);
}
