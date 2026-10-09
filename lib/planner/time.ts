/**
 * Pure date maths for the planner. No imports (so it runs on the server, in the browser and under
 * `node --test`), and no hidden time zone: "local" always means the machine's zone, which in the browser is
 * the person looking at the calendar. The server never reasons about local days, it only compares instants.
 */

export const MS_MINUTE = 60_000;
export const MS_DAY = 24 * 60 * MS_MINUTE;

// "2026-09-24 20:39:54.123+00" / "...+05:30" (what timestamptz columns come back as)
const PG_TIMESTAMPTZ = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}(?::?\d{2})?)$/;

/**
 * Postgres timestamptz text ("2026-09-24 20:39:54+00") or ISO -> Date. Returns null for garbage instead of an
 * Invalid Date. The Postgres form is rewritten to strict ISO first: Safari refuses to parse it as it is.
 */
export function parseInstant(value: string | Date | null | undefined): Date | null {
    if (value === null || value === undefined) return null;
    let input: string | Date = value;
    if (typeof value === 'string') {
        const m = PG_TIMESTAMPTZ.exec(value.trim());
        if (m) {
            const [, day, time, zone] = m;
            const offset = zone === 'Z' ? 'Z' : zone.length === 3 ? `${zone}:00` : zone.length === 5 ? `${zone.slice(0, 3)}:${zone.slice(3)}` : zone;
            input = `${day}T${time}${offset}`;
        }
    }
    const d = input instanceof Date ? input : new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
}

export const addMinutes = (date: Date, minutes: number): Date => new Date(date.getTime() + minutes * MS_MINUTE);

/** When a lesson that starts at `start` and lasts `durationMinutes` ends. */
export const lessonEnd = (start: Date, durationMinutes: number): Date => addMinutes(start, durationMinutes);

/** Half-open overlap: a lesson ending at 10:00 does not collide with one starting at 10:00. */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
    return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/* ─────────────────────────────  Local calendar days  ───────────────────────────── */

export const startOfLocalDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** `setDate`-based so a DST change never shifts the wall-clock time (adding 24h would). */
export function addLocalDays(d: Date, days: number): Date {
    const copy = new Date(d.getTime());
    copy.setDate(copy.getDate() + days);
    return copy;
}

/** 0 = Sunday ... 6 = Saturday. The planner's week starts on Sunday, like the "Sunday - Tuesday - Thursday" schedules it is for. */
export function startOfLocalWeek(d: Date, weekStartsOn = 0): Date {
    const day = startOfLocalDay(d);
    const diff = (day.getDay() - weekStartsOn + 7) % 7;
    return addLocalDays(day, -diff);
}

export const isSameLocalDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** The seven local days of the week containing `d`. */
export function weekDays(d: Date, weekStartsOn = 0): Date[] {
    const start = startOfLocalWeek(d, weekStartsOn);
    return Array.from({ length: 7 }, (_, i) => addLocalDays(start, i));
}

export const minutesIntoLocalDay = (d: Date): number => d.getHours() * 60 + d.getMinutes();

/**
 * Lessons logged with the older form have a date but no time: they were saved at exactly local midnight.
 * A planner can't place those on an hour grid, so they are shown as "no time set" at the top of their day.
 */
export const hasNoTimeOfDay = (d: Date): boolean =>
    d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;

/** "HH:mm" -> { hours, minutes }, or null when it isn't a real time. */
export function parseTimeOfDay(value: string): { hours: number; minutes: number } | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes };
}

/** A local calendar day plus an "HH:mm" -> that wall-clock instant. */
export function combineDayAndTime(day: Date, time: string): Date | null {
    const t = parseTimeOfDay(time);
    if (!t) return null;
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), t.hours, t.minutes, 0, 0);
}

export const toTimeInputValue = (d: Date): string =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/* ─────────────────────────────  Weekly repeat  ───────────────────────────── */

/**
 * The start times of a weekly schedule: starting on `first`, for `weeks` weeks, on each weekday in `weekdays`
 * (0 = Sunday ... 6 = Saturday), always at `first`'s local time of day. The day of `first` is always included.
 *
 *   first = Sunday 17:00, weekdays = [0, 2, 4], weeks = 2  ->  Sun, Tue, Thu, Sun, Tue, Thu (all 17:00)
 *
 * Built day by day with local-calendar arithmetic, so the wall-clock time survives a DST change.
 * The browser turns the result into ISO instants and the server validates each one on its own.
 */
export function weeklyOccurrences(first: Date, weekdays: readonly number[], weeks: number): Date[] {
    const wanted = new Set(weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6));
    wanted.add(first.getDay());
    const days = Math.max(1, Math.floor(weeks)) * 7;
    const out: Date[] = [];
    for (let i = 0; i < days; i++) {
        const day = addLocalDays(first, i);
        if (wanted.has(day.getDay())) out.push(day);
    }
    return out;
}

/* ─────────────────────────────  Overlapping events in one day column  ───────────────────────────── */

export type Positioned<T> = T & { col: number; cols: number };

/**
 * Lays out events (minutes into the day) that may overlap so they sit side by side instead of on top of each
 * other. Events that touch, directly or through a chain of overlaps, share a cluster and split its width.
 */
export function layoutOverlapping<T extends { start: number; end: number }>(events: readonly T[]): Positioned<T>[] {
    const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end);
    const result: Positioned<T>[] = [];

    let cluster: { event: T; col: number }[] = [];
    let columnEnds: number[] = [];
    let clusterEnd = -Infinity;

    const flush = () => {
        const cols = Math.max(1, columnEnds.length);
        for (const { event, col } of cluster) result.push({ ...event, col, cols });
        cluster = [];
        columnEnds = [];
        clusterEnd = -Infinity;
    };

    for (const event of sorted) {
        if (cluster.length > 0 && event.start >= clusterEnd) flush();

        let col = columnEnds.findIndex((end) => end <= event.start);
        if (col === -1) {
            col = columnEnds.length;
            columnEnds.push(event.end);
        } else {
            columnEnds[col] = event.end;
        }
        cluster.push({ event, col });
        clusterEnd = Math.max(clusterEnd, event.end);
    }
    flush();
    return result;
}
