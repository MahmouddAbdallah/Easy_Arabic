import { calendarDaysBetween } from "./dateSeparators";

const timeOfDay = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const monthDay = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const monthDayYear = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" });

/**
 * How a conversation list says "when": the time for today, "Yesterday", the weekday for the rest of the week,
 * then the date. Short on purpose: it sits in the corner of a row.
 */
export function formatListTime(date: Date, today: Date): string {
    if (Number.isNaN(date.getTime())) return "";
    const daysAgo = calendarDaysBetween(date, today);
    if (daysAgo <= 0) return timeOfDay.format(date);
    if (daysAgo === 1) return "Yesterday";
    if (daysAgo < 7) return weekday.format(date);
    return date.getFullYear() === today.getFullYear() ? monthDay.format(date) : monthDayYear.format(date);
}
