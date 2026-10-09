import { format, isSameDay } from 'date-fns';
import { parseInstant } from '@/lib/planner/time';

/**
 * Display helpers. They format in the VIEWER'S time zone (the browser's), which is what a lesson time should mean to
 * the person looking at it. Only call them from client components after mount: a server render would use the server's
 * zone and disagree with the browser.
 */
const d = (iso: string) => parseInstant(iso) ?? new Date(NaN);

export const fmtDay = (iso: string) => format(d(iso), 'EEE, MMM d');
export const fmtDayLong = (iso: string) => format(d(iso), 'EEEE, MMMM d, yyyy');
export const fmtTime = (iso: string) => format(d(iso), 'h:mm a');
export const fmtDateTime = (iso: string) => `${fmtDay(iso)} · ${fmtTime(iso)}`;

/** "5:00 PM – 6:00 PM" */
export const fmtTimeRange = (startIso: string, endIso: string) => `${fmtTime(startIso)} – ${fmtTime(endIso)}`;

/** "Sun, Oct 4 · 5:00 PM – 6:00 PM" (adds the end's date if the lesson crosses midnight) */
export function fmtWhen(startIso: string, endIso: string) {
    const start = d(startIso);
    const end = d(endIso);
    return isSameDay(start, end) ? `${fmtDay(startIso)} · ${fmtTimeRange(startIso, endIso)}` : `${fmtDateTime(startIso)} – ${fmtDateTime(endIso)}`;
}

/** 60 -> "1 hr", 90 -> "1 hr 30 min", 45 -> "45 min" */
export function fmtDuration(minutes: number) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} min`;
    return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export const fmtRelativeDay = (iso: string) => format(d(iso), 'MMM d, yyyy');
