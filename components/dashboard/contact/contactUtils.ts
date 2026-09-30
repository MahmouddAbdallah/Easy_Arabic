import { format, isThisYear, isToday } from "date-fns";

/* -------------------------------------------------------------------------- */
/*  Query contract                                                            */
/*  /dashboard/contact?keyword=mohamed&status=read&page=2                      */
/*  Shared by the server page (parse) and the client UI (read / write).        */
/* -------------------------------------------------------------------------- */

export const CONTACT_STATUSES = ["unread", "read"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACTS_PAGE_SIZE = 10;
export const MAX_KEYWORD_LENGTH = 100;

export type ContactQuery = {
    /** Trimmed search text. Empty string when there is no search. */
    keyword: string;
    /** `null` means "all messages". */
    status: ContactStatus | null;
    /** 1-based page number. */
    page: number;
};

type ParamValue = string | string[] | null | undefined;
type ParamGetter = { get(key: string): string | null };
/** Accepts Next's `searchParams` object or a `URLSearchParams` instance. */
export type ContactParamSource = ParamGetter | Record<string, ParamValue>;

function readParam(source: ContactParamSource, key: string): string {
    const getter = (source as ParamGetter).get;
    const raw: ParamValue =
        typeof getter === "function"
            ? (source as ParamGetter).get(key)
            : (source as Record<string, ParamValue>)[key];
    return (Array.isArray(raw) ? raw[0] : raw) ?? "";
}

export function parseContactQuery(source: ContactParamSource): ContactQuery {
    const keyword = readParam(source, "keyword").trim().slice(0, MAX_KEYWORD_LENGTH);

    const rawStatus = readParam(source, "status");
    const status = (CONTACT_STATUSES as readonly string[]).includes(rawStatus)
        ? (rawStatus as ContactStatus)
        : null;

    const rawPage = Number.parseInt(readParam(source, "page"), 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

    return { keyword, status, page };
}

export const hasActiveContactFilters = (query: Pick<ContactQuery, "keyword" | "status">) =>
    Boolean(query.keyword || query.status);

/* -------------------------------------------------------------------------- */
/*  Display helpers                                                           */
/* -------------------------------------------------------------------------- */

const toDate = (value: string | number | Date | null | undefined) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
};

/** Inbox-style date: `2:14 PM` today, `Sep 12` this year, `Sep 12, 2025` before. */
export function formatListDate(value: string | number | Date | null | undefined): string {
    const date = toDate(value);
    if (!date) return "";
    if (isToday(date)) return format(date, "h:mm a");
    if (isThisYear(date)) return format(date, "MMM d");
    return format(date, "MMM d, yyyy");
}

/** Full date for tooltips and the details dialog. */
export function formatFullDate(value: string | number | Date | null | undefined): string {
    const date = toDate(value);
    return date ? format(date, "EEE, MMM d, yyyy 'at' h:mm a") : "Unknown date";
}

export function getInitials(name?: string | null, fallback?: string | null): string {
    const source = (name || fallback || "").trim();
    if (!source) return "?";
    const parts = source.split(/\s+/).filter(Boolean);
    const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2);
    return letters.toUpperCase();
}

/** Collapses whitespace so multi-line messages read as a single preview line. */
export const toPreview = (message: string | null | undefined, max = 200) =>
    (message ?? "").replace(/\s+/g, " ").trim().slice(0, max);
