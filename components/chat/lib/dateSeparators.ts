import type { MessageType } from "../types";

/** Kept in one place so they can move to a translation layer if the app ever gets one. */
const TODAY_LABEL = "Today";
const YESTERDAY_LABEL = "Yesterday";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// No locale given = the reader's own locale, the same behaviour as the message times (`toLocaleTimeString([])`).
const absoluteDate = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" });
const fullDate = new Intl.DateTimeFormat(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

/**
 * The reader's calendar day as `YYYY-MM-DD`. Built from LOCAL date parts on purpose: a message sent at
 * 00:30 local time belongs to that local day even though its UTC date may be the day before.
 */
export function getDayKey(date: Date): string {
    const year = String(date.getFullYear()).padStart(4, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/**
 * Whole calendar days from `from` to `to` in the reader's timezone (1 = `to` is the next day).
 * Compares dates, never durations, so a 23- or 25-hour day around a clock change still counts as one day.
 */
export function calendarDaysBetween(from: Date, to: Date): number {
    const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
    const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((end - start) / MS_PER_DAY);
}

export function isSameDay(a: Date, b: Date): boolean {
    return calendarDaysBetween(a, b) === 0;
}

/** Milliseconds from `now` until the next local midnight. */
export function msUntilNextDay(now: Date): number {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
}

/** "Today", "Yesterday", or a readable absolute date such as "Oct 7, 2026". */
export function formatDayLabel(date: Date, today: Date): string {
    const daysAgo = calendarDaysBetween(date, today);
    if (daysAgo === 0) return TODAY_LABEL;
    if (daysAgo === 1) return YESTERDAY_LABEL;
    // Older, and also "in the future" (a device clock running behind the server's): say the real date.
    return absoluteDate.format(date);
}

const isValidDate = (date: Date | null): date is Date => date !== null && !Number.isNaN(date.getTime());

/** Messages by the same person this close together read as one burst and are drawn as one connected group. */
const CLUSTER_GAP_MS = 5 * 60 * 1000;

function belongTogether(a: MessageType, b: MessageType): boolean {
    if (a.call || b.call || a.senderId !== b.senderId) return false;
    if (!isValidDate(a.sentAt) || !isValidDate(b.sentAt)) return false;
    const gap = b.sentAt.getTime() - a.sentAt.getTime();
    return gap >= 0 && gap < CLUSTER_GAP_MS;
}

/** One message of a day, and whether it is drawn joined to the message before it. */
export interface MessageRow {
    message: MessageType;
    joinsPrevious: boolean;
}

/** One calendar day of the conversation: its heading and its messages. */
export interface DaySection {
    /** Unique within the list: there is exactly one section per calendar day. */
    key: string;
    label: string;
    title: string;
    dateTime: string;
    rows: MessageRow[];
}

/**
 * The conversation as days. Each day is its own section so its heading can stay at the top of the screen while
 * the day scrolls past (and be replaced by the next day's heading, which is how every messenger does it).
 * Days come from `sentAt` (the stored timestamp), never from the formatted `time` string, so a day stays right when
 * older pages are added above it and for edited or deleted messages (they keep their `sentAt`) and call logs. A
 * message without a readable time stays in the section it follows.
 */
export function groupByDay(messages: readonly MessageType[], today: Date): DaySection[] {
    const sections: DaySection[] = [];
    const seenDays = new Set<string>();
    let current: DaySection | null = null;

    for (const message of messages) {
        const { sentAt } = message;

        if (isValidDate(sentAt)) {
            const dayKey = getDayKey(sentAt);
            if (!seenDays.has(dayKey)) {
                seenDays.add(dayKey);
                current = {
                    key: `day:${dayKey}`,
                    label: formatDayLabel(sentAt, today),
                    title: fullDate.format(sentAt),
                    dateTime: dayKey,
                    rows: [],
                };
                sections.push(current);
            }
        } else if (!current) {
            current = { key: "day:undated", label: "", title: "", dateTime: "", rows: [] };
            sections.push(current);
        }

        current?.rows.push({ message, joinsPrevious: false });
    }

    for (const section of sections) {
        const { rows } = section;
        for (let i = 0; i < rows.length; i += 1) {
            rows[i].joinsPrevious = i > 0 && belongTogether(rows[i - 1].message, rows[i].message);
        }
    }

    return sections;
}
