/**
 * SERVER ONLY — uses firebase-admin. Never import this from a client component.
 *
 * Searches the history of ONE chat for the words the user typed.
 *
 * Firestore can't search inside text (no substring or full-text query), so the history is read newest
 * first, in batches, and each message is checked here. Everything below exists to keep that cheap:
 *
 *  - It stops as soon as a page of results is full, so a common word costs a few hundred reads at most.
 *  - Batch sizes follow the hit rate seen so far, so a page isn't over-read by a whole big batch.
 *  - A batch that has been read is always used up: its matches are all returned, never thrown away to be
 *    read a second time by the next request (so a page can hold a few more than CHAT_SEARCH_PAGE_SIZE).
 *  - One request never reads more than SCAN_BUDGET messages. A word that matches nothing therefore
 *    costs a bounded amount per request; the response says where it stopped (`nextCursor`) and the
 *    browser decides whether to keep going.
 *  - Only the fields the search needs are fetched (`select`), and deleted messages and call entries
 *    are skipped without any further work.
 *  - The cursor is (time, document id), so two messages with the very same timestamp can never be skipped.
 */
import { FieldPath, type DocumentData, type Query } from "firebase-admin/firestore";
import { firebaseAdminDB } from "@/lib/config/firebase-admin";
import { getMessageAttachments } from "./attachments";
import {
    CHAT_SEARCH_PAGE_SIZE,
    buildSnippet,
    findHighlights,
    parseSearchQuery,
    type ChatSearchResponse,
    type ChatSearchResult,
} from "./chatSearch";
import { ChatApiError } from "./messageOperations.server";

/** Most messages one request looks through. */
const SCAN_BUDGET = 600;
/** Only a freak run of hits (a batch sized for a rare word that turns out to match everything) cuts a batch short. */
const MAX_RESULTS = CHAT_SEARCH_PAGE_SIZE * 2;
const MIN_BATCH = 30;
const MAX_BATCH = 300;
/** Never assume fewer matches than this, or the first empty batch would ask for the moon. */
const MIN_HIT_RATE = 0.02;
/** Read a little more than the estimate says is needed: a short batch costs a whole extra round trip. */
const OVERSHOOT = 1.1;

/** Fields the search looks at. Everything else on the message stays in Firestore. */
const SEARCH_FIELDS = ["senderId", "text", "time", "deleted", "type", "attachments", "attachment"];

const ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;
const MAX_TIME_LENGTH = 40;

interface Cursor {
    time: string;
    id: string;
}

export function encodeSearchCursor({ time, id }: Cursor): string {
    return Buffer.from(JSON.stringify([time, id]), "utf8").toString("base64url");
}

/** Null for anything that isn't exactly what `encodeSearchCursor` produces: the cursor comes from the client. */
export function decodeSearchCursor(raw: string): Cursor | null {
    try {
        const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
        if (!Array.isArray(parsed) || parsed.length !== 2) return null;

        const [time, id] = parsed as unknown[];
        if (typeof time !== "string" || time.length === 0 || time.length > MAX_TIME_LENGTH) return null;
        if (typeof id !== "string" || !ID_PATTERN.test(id)) return null;
        return { time, id };
    } catch {
        return null;
    }
}

/** The result for one message, or null when it doesn't match (or isn't a searchable message at all). */
function matchMessage(id: string, data: DocumentData, terms: readonly string[]): ChatSearchResult | null {
    // A finished call is history, not a message; a deleted message has had its content erased.
    if (data.type === "call" || data.deleted === true) return null;
    if (typeof data.time !== "string") return null;

    const senderId = typeof data.senderId === "string" ? data.senderId : "";
    const text = typeof data.text === "string" ? data.text : "";
    const hasFiles = data.attachments !== undefined || data.attachment !== undefined;
    const attachments = hasFiles ? getMessageAttachments(data) : [];

    const base = { id, senderId, time: data.time, attachmentCount: attachments.length };

    const textRanges = findHighlights(text, terms);
    if (textRanges) {
        const { snippet, highlights } = buildSnippet(text, textRanges);
        return {
            ...base,
            snippet,
            highlights,
            matchedIn: "text",
            attachmentType: attachments[0]?.type ?? null,
        };
    }

    // No match in the text: a file's name counts too ("invoice" finds "invoice-march.pdf").
    // Voice messages carry a generated name, which would only ever be noise.
    for (const attachment of attachments) {
        if (attachment.type === "audio" || !attachment.fileName) continue;

        const nameRanges = findHighlights(attachment.fileName, terms);
        if (!nameRanges) continue;

        const { snippet, highlights } = buildSnippet(attachment.fileName, nameRanges);
        return { ...base, snippet, highlights, matchedIn: "fileName", attachmentType: attachment.type };
    }

    return null;
}

/**
 * How many messages to read next, given what this request has found so far.
 * The first batch is small on purpose: it only has to show how common the word is, and a small one can
 * never over-read a word that matches nearly everything (every request starts from nothing, so a bigger
 * guess would be paid again on every page). The rest are sized from the hit rate it measured.
 */
function nextBatchSize(found: number, scanned: number): number {
    if (scanned === 0) return MIN_BATCH;

    const hitRate = Math.max(found / scanned, MIN_HIT_RATE);
    const wanted = Math.ceil(((CHAT_SEARCH_PAGE_SIZE - found) / hitRate) * OVERSHOOT);
    return Math.min(Math.max(wanted, MIN_BATCH), MAX_BATCH, SCAN_BUDGET - scanned);
}

interface SearchParams {
    /** The signed-in user (from the session, never from the request). */
    userId: string;
    chatId: string;
    query: string;
    /** Where the previous response stopped; absent for the first request. */
    cursor?: string;
}

export async function searchChatMessages({ userId, chatId, query, cursor }: SearchParams): Promise<ChatSearchResponse> {
    const empty: ChatSearchResponse = { success: true, results: [], nextCursor: null, scanned: 0 };

    const terms = parseSearchQuery(query);
    if (terms.length === 0) return empty;

    let position: Cursor | null = null;
    if (cursor) {
        position = decodeSearchCursor(cursor);
        if (!position) throw new ChatApiError("INVALID_CURSOR", "Invalid search position.", 400);
    }

    // The chat id is `<idA>_<idB>`: only the chat document says who is really in it.
    const chatRef = firebaseAdminDB.collection("chats").doc(chatId);
    const chatSnap = await chatRef.get();
    // No chat yet = no messages yet: nothing to find, which is not an error.
    if (!chatSnap.exists) return empty;

    const participants: unknown = chatSnap.get("participants");
    if (!Array.isArray(participants) || !participants.includes(userId)) {
        throw new ChatApiError("NOT_A_PARTICIPANT", "You are not a participant in this chat.", 403);
    }

    const newestFirst: Query = chatRef
        .collection("messages")
        .orderBy("time", "desc")
        // Same direction as `time`, so no extra index is needed: it only makes the order total (and the cursor exact).
        .orderBy(FieldPath.documentId(), "desc")
        .select(...SEARCH_FIELDS);

    const results: ChatSearchResult[] = [];
    let scanned = 0;
    let exhausted = false;

    while (results.length < CHAT_SEARCH_PAGE_SIZE && scanned < SCAN_BUDGET) {
        const size = nextBatchSize(results.length, scanned);
        const batch = await (position ? newestFirst.startAfter(position.time, position.id) : newestFirst)
            .limit(size)
            .get();

        let processed = 0;
        for (const doc of batch.docs) {
            processed += 1;
            scanned += 1;

            const time: unknown = doc.get("time");
            // Every writer stores an ISO string; anything else can't be resumed from, so stop rather than loop.
            if (typeof time !== "string") {
                exhausted = true;
                break;
            }
            position = { time, id: doc.id };

            const result = matchMessage(doc.id, doc.data(), terms);
            if (result) results.push(result);
            // The batch is paid for: use all of it (see the header) unless the response would get silly.
            if (results.length >= MAX_RESULTS) break;
        }

        // Fewer documents than asked for, and all of them looked at: that was the oldest message.
        if (processed === batch.size && batch.size < size) exhausted = true;
        if (exhausted) break;
    }

    return {
        success: true,
        results,
        nextCursor: !exhausted && position ? encodeSearchCursor(position) : null,
        scanned,
    };
}
