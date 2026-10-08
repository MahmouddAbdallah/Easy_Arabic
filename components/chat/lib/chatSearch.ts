import type { AttachmentType } from "../types";

/**
 * In-chat search rules shared by the browser and the server. Pure helpers: no secrets, no Node or
 * browser APIs, no zod (the request schema lives in schemas.ts so zod never reaches the client bundle).
 *
 * The SERVER decides what matches (it scans the history); the BROWSER uses the very same functions to
 * highlight the words inside the message bubbles. Sharing the code is what keeps the two in agreement:
 * a message the server returned always gets its words highlighted when you jump to it.
 */

export const CHAT_SEARCH_API_URL = "/api/chat/messages/search";

/** DOM id of the search panel: the header's search button points at it (aria-controls). */
export const CHAT_SEARCH_PANEL_ID = "chat-search-panel";

/** Longest query accepted (also the `maxLength` of the input). */
export const CHAT_SEARCH_MAX_QUERY_LENGTH = 100;

/** A query is split into words and a message must contain ALL of them; more than this are ignored. */
export const CHAT_SEARCH_MAX_TERMS = 8;

/** Results a response aims for: it stops looking once it has this many (it may hand back a few more, see chatSearch.server.ts). */
export const CHAT_SEARCH_PAGE_SIZE = 20;

/** Pause after the last keystroke before a request is sent. */
export const CHAT_SEARCH_DEBOUNCE_MS = 350;

/** Highlights kept per snippet / per message bubble: a pathological message must not create thousands of nodes. */
const MAX_HIGHLIGHTS = 50;

/** Characters of context shown before the first match, and the longest snippet. */
const SNIPPET_LEAD = 24;
const SNIPPET_LENGTH = 140;

/** `[start, end)` offsets (UTF-16 code units, like `String.slice`) of a highlighted stretch of text. */
export type HighlightRange = [start: number, end: number];

/** Where the words were found: in the message text, or in the name of an attached file. */
export type ChatSearchMatchedIn = "text" | "fileName";

/** One message that matches the search, as sent by GET /api/chat/messages/search. */
export interface ChatSearchResult {
    id: string;
    senderId: string;
    /** The stored send time (ISO string): the message's place in the conversation, never changed by an edit. */
    time: string;
    /** A short excerpt around the first match, with "…" where it was cut. Plain text: render it, don't parse it. */
    snippet: string;
    /** Highlighted stretches of `snippet`. */
    highlights: HighlightRange[];
    matchedIn: ChatSearchMatchedIn;
    /** The matched file's kind, or the first attachment's kind for a text match; null when there are none. */
    attachmentType: AttachmentType | null;
    attachmentCount: number;
}

export interface ChatSearchResponse {
    success: true;
    results: ChatSearchResult[];
    /** Opaque; pass it back as `cursor` for the next (older) results. Null when the whole history was searched. */
    nextCursor: string | null;
    /** How many messages were looked through for this response. */
    scanned: number;
}

/* -------------------------------------------------------------------------------------------------
 * Folding: what "the same letter" means for search
 * ---------------------------------------------------------------------------------------------- */

/**
 * Dropped before comparing: combining marks (Arabic tashkeel such as fatha/damma/shadda, Latin accents),
 * the Arabic tatweel (ـ) and invisible format characters (zero-width joiners, bidi marks...). Typing
 * "مدرسة" finds "مَدْرَسَةٌ", and "cafe" finds "café".
 */
const IGNORED = /[\p{M}\p{Cf}\u0640]/gu;

/** Letters that are different code points but the same letter for anyone searching. */
const LETTER_FOLDS: Record<string, string> = {
    "\u0649": "\u064A", // ى alef maksura -> ي
    "\u06CC": "\u064A", // ی Farsi yeh   -> ي
    "\u0629": "\u0647", // ة teh marbuta -> ه
    "\u06A9": "\u0643", // ک keheh       -> ك
    "\u0671": "\u0627", // ٱ alef wasla  -> ا
};
const LETTER_FOLD_PATTERN = /[\u0649\u06CC\u0629\u06A9\u0671]/g;

const WHITESPACE = /\s/u;

function foldChar(char: string): string {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) return char.toLowerCase();

    // Arabic-Indic (٠-٩) and Persian (۰-۹) digits -> 0-9
    if (code >= 0x0660 && code <= 0x0669) return String.fromCharCode(48 + code - 0x0660);
    if (code >= 0x06f0 && code <= 0x06f9) return String.fromCharCode(48 + code - 0x06f0);

    // NFKD splits أ إ آ ؤ ئ into their base letter + a mark (and ligatures such as ﻻ into لا); the marks are then dropped.
    return char
        .toLowerCase()
        .normalize("NFKD")
        .replace(IGNORED, "")
        .replace(LETTER_FOLD_PATTERN, (letter) => LETTER_FOLDS[letter] ?? letter);
}

interface Folded {
    text: string;
    /** For every UTF-16 unit of `text`: where its original character starts / ends. Only built on request. */
    starts?: number[];
    ends?: number[];
}

/**
 * `text` in its comparable form: lower case, accents/tashkeel removed, Arabic letter variants merged,
 * digits unified, runs of whitespace reduced to one space.
 *
 * With `trackOffsets` it also records where each folded unit came from, so a match can be mapped back
 * onto the ORIGINAL text for highlighting. (Scanning many messages only needs the cheap form.)
 */
function fold(source: string, trackOffsets: boolean): Folded {
    let text = "";
    const starts: number[] = [];
    const ends: number[] = [];
    let previousWasSpace = false;
    let index = 0;

    for (const char of source) {
        const start = index;
        const end = index + char.length;
        index = end;

        let piece: string;
        if (WHITESPACE.test(char)) {
            piece = previousWasSpace ? "" : " ";
            previousWasSpace = true;
        } else {
            piece = foldChar(char);
            // A dropped mark (tashkeel...) says nothing about the space before it.
            if (piece !== "") previousWasSpace = false;
        }

        text += piece;
        if (trackOffsets) {
            for (let unit = 0; unit < piece.length; unit++) {
                starts.push(start);
                ends.push(end);
            }
        }
    }

    return trackOffsets ? { text, starts, ends } : { text };
}

/**
 * The words of a search query in comparable form: folded, de-duplicated, at most CHAT_SEARCH_MAX_TERMS.
 * Empty when the query has nothing searchable in it (blank, or only marks).
 */
export function parseSearchQuery(raw: string): string[] {
    const terms = new Set<string>();
    for (const word of fold(raw, false).text.split(" ")) {
        if (word) terms.add(word);
        if (terms.size >= CHAT_SEARCH_MAX_TERMS) break;
    }
    return [...terms];
}

/* -------------------------------------------------------------------------------------------------
 * Matching and highlighting
 * ---------------------------------------------------------------------------------------------- */

/** Does `text` contain every term? (Cheap: no offsets.) */
export function matchesTerms(text: string, terms: readonly string[]): boolean {
    if (terms.length === 0 || !text) return false;
    const { text: folded } = fold(text, false);
    return terms.every((term) => folded.includes(term));
}

/**
 * Where the terms are in `text`, as sorted, non-overlapping `[start, end)` ranges of the ORIGINAL text
 * (a match that covers a letter also covers the accents/tashkeel written after it).
 * Null when the text does not contain every term; an empty list is never returned.
 */
export function findHighlights(text: string, terms: readonly string[]): HighlightRange[] | null {
    if (terms.length === 0 || !text) return null;

    const { text: folded, starts = [], ends = [] } = fold(text, true);
    const found: HighlightRange[] = [];

    for (const term of terms) {
        let from = folded.indexOf(term);
        if (from === -1) return null; // every term has to be there

        while (from !== -1 && found.length < MAX_HIGHLIGHTS * 4) {
            const last = from + term.length - 1;
            const start = starts[from];
            // Include whatever was dropped right after the match (a fatha, a tatweel...), unless the
            // next folded unit comes from the SAME original character (then the character is the end).
            const nextStart = starts[last + 1];
            const end = nextStart !== undefined && nextStart !== starts[last] ? nextStart : ends[last];
            found.push([start, end]);
            from = folded.indexOf(term, from + term.length);
        }
    }

    // Merge overlaps and touching ranges (two terms can share letters).
    found.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const merged: HighlightRange[] = [];
    for (const [start, end] of found) {
        const previous = merged[merged.length - 1];
        if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
        else merged.push([start, end]);
    }
    return merged.slice(0, MAX_HIGHLIGHTS);
}

/* -------------------------------------------------------------------------------------------------
 * Snippets
 * ---------------------------------------------------------------------------------------------- */

const isLowSurrogate = (text: string, index: number): boolean => {
    const code = text.charCodeAt(index);
    return code >= 0xdc00 && code <= 0xdfff;
};

/**
 * A short excerpt of `text` that shows the first match (a few words of context before it), with "…" at
 * a cut end, and `ranges` moved to fit it. Never cuts through a word or an emoji when it can avoid it.
 */
export function buildSnippet(
    text: string,
    ranges: readonly HighlightRange[]
): { snippet: string; highlights: HighlightRange[] } {
    if (text.length <= SNIPPET_LENGTH || ranges.length === 0) {
        return { snippet: text, highlights: ranges.map(([start, end]) => [start, end]) };
    }

    const [firstStart, firstEnd] = ranges[0];

    let start = Math.max(0, firstStart - SNIPPET_LEAD);
    if (start > 0) {
        // Begin at a word boundary when there is one before the match.
        const boundary = text.slice(start, firstStart).search(/\s/u);
        if (boundary !== -1) start += boundary + 1;
        if (isLowSurrogate(text, start)) start += 1;
    }

    let end = Math.min(text.length, Math.max(start + SNIPPET_LENGTH, firstEnd));
    if (end < text.length) {
        // End at a word boundary when one is close enough (never inside the first match).
        const room = text.slice(Math.max(firstEnd, end - 20), end);
        const boundary = room.search(/\s\S*$/u);
        if (boundary !== -1) end = Math.max(firstEnd, end - 20) + boundary;
        if (isLowSurrogate(text, end)) end -= 1;
    }

    const prefix = start > 0 ? "…" : "";
    const suffix = end < text.length ? "…" : "";
    const shift = prefix.length - start;

    const highlights: HighlightRange[] = [];
    for (const [rangeStart, rangeEnd] of ranges) {
        if (rangeEnd <= start || rangeStart >= end) continue;
        highlights.push([Math.max(rangeStart, start) + shift, Math.min(rangeEnd, end) + shift]);
    }

    return { snippet: prefix + text.slice(start, end) + suffix, highlights };
}
