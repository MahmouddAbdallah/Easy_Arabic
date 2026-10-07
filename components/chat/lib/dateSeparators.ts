import type { MessageType } from "../types";

/** Kept in one place so they can move to a translation layer if the app ever gets one. */
const TODAY_LABEL = "Today";
const YESTERDAY_LABEL = "Yesterday";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// No locale given = the reader's own locale, the same behaviour as the message times (`toLocaleTimeString([])`).
const absoluteDate = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" });
const fullDate = new Intl.DateTimeFormat(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

/** One entry of the conversation as rendered: a message (or call log), or the date separator that opens a day. */
export type TimelineItem =
    | {
          type: "separator";
          /** Unique within the list: there is exactly one separator per calendar day. */
          key: string;
          /** "Today", "Yesterday" or a date such as "Oct 7, 2026". */
          label: string;
          /** Full date for the tooltip, e.g. "Wednesday, October 7, 2026". */
          title: string;
          /** Machine-readable day (YYYY-MM-DD), for the <time> element. */
          dateTime: string;
      }
    | { type: "message"; message: MessageType };

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

/**
 * Interleaves a date separator before the first message of every calendar day.
 *
 * Days come from `sentAt` (the stored timestamp), never from the formatted `time` string. Messages are in
 * chronological order, so each day is one run and the first message of that run opens it: that stays right
 * when older pages are added above (a day that continues upward simply gets its separator moved up),
 * and for new live messages, edited or deleted messages (they keep their `sentAt`) and call logs.
 */
export function withDaySeparators(messages: readonly MessageType[], today: Date): TimelineItem[] {
    const items: TimelineItem[] = [];
    const seenDays = new Set<string>();

    for (const message of messages) {
        const { sentAt } = message;

        if (isValidDate(sentAt)) {
            const dayKey = getDayKey(sentAt);
            if (!seenDays.has(dayKey)) {
                seenDays.add(dayKey);
                items.push({
                    type: "separator",
                    key: `day:${dayKey}`,
                    label: formatDayLabel(sentAt, today),
                    title: fullDate.format(sentAt),
                    dateTime: dayKey,
                });
            }
        }

        items.push({ type: "message", message });
    }

    return items;
}
