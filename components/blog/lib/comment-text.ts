/**
 * Cleaning and sanity checks for what visitors type into the comment form. Pure functions (no I/O),
 * used by the request schemas and the data layer.
 *
 * Comments are plain text end to end: they are stored as typed (minus invisible control characters)
 * and shown through React text nodes, which escape everything. There is no HTML, no Markdown and no
 * auto-linking, so a comment can never inject markup or earn a spammer a clickable link.
 */
import { COMMENT_LIMITS } from "./constants";

/**
 * Characters that are invisible or that re-order text on screen. Stripped so a name or comment can't
 * hide content or spoof someone else's. Deliberately NOT stripped: the left/right marks (U+200E/F) and
 * the zero-width non-joiner/joiner (U+200C/D), which Arabic and Persian writing genuinely uses.
 */
const INVISIBLE_OR_BIDI_OVERRIDE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B\u2060\uFEFF\u202A-\u202E\u2066-\u2069]/g;

/** A single-line field (name, email): normalised, invisible characters removed, whitespace collapsed. */
export function cleanLine(input: string): string {
    return input.normalize("NFC").replace(INVISIBLE_OR_BIDI_OVERRIDE, "").replace(/\s+/g, " ").trim();
}

/** The comment text: line breaks kept (at most one blank line in a row), everything else tidied. */
export function cleanBody(input: string): string {
    return input
        .normalize("NFC")
        .replace(/\r\n?/g, "\n")
        .replace(INVISIBLE_OR_BIDI_OVERRIDE, "")
        .replace(/\t/g, " ")
        .replace(/[^\S\n]+/g, " ")
        .replace(/ ?\n ?/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

const URL_LIKE = /(?:https?:\/\/|www\.)\S+/gi;
const BARE_DOMAIN = /\b[a-z0-9-]+\.(?:com|net|org|info|biz|xyz|ru|cn|top|click|shop|online|site|link|store|live)\b/gi;

/** How many web addresses the text contains (written out or as a bare domain). */
export function countLinks(text: string): number {
    const withoutUrls = text.replace(URL_LIKE, " ");
    return (text.match(URL_LIKE)?.length ?? 0) + (withoutUrls.match(BARE_DOMAIN)?.length ?? 0);
}

export const hasLink = (text: string) => countLinks(text) > 0;

/**
 * Why this comment looks like noise rather than a person writing, or `null` if it passes. Kept
 * conservative on purpose: a false positive turns away a real reader, while anything borderline can
 * simply be held for review.
 */
export function rejectionReason(body: string): string | null {
    if (countLinks(body) > COMMENT_LIMITS.maxLinks) {
        return `Please include at most ${COMMENT_LIMITS.maxLinks} links in a comment.`;
    }
    const letters = body.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
    if (letters < COMMENT_LIMITS.minBody) return "Please write a few words.";
    // 12+ of the same character in a row ("aaaaaaaaaaaa", "!!!!!!!!!!!!") is never a real sentence.
    if (/(\P{M}\p{M}*)\1{11,}/u.test(body)) return "That doesn't look like a real comment.";
    return null;
}

/** The text compared when spotting a repeat of the same comment: case, spacing and punctuation don't matter. */
export const duplicateKey = (body: string) =>
    body.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
