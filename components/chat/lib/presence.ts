import { format, isToday, isYesterday } from "date-fns";

/** "today at 3:45 PM", "yesterday at 9:02 AM", or "Oct 7, 2026". Empty when the time isn't a real date. */
export function formatLastSeen(timestamp: number): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";
    if (isToday(date)) return `today at ${format(date, "p")}`;
    if (isYesterday(date)) return `yesterday at ${format(date, "p")}`;
    return format(date, "PP");
}
