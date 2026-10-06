/** Display helpers shared by the public pages and the dashboard. */

/** Fixed to UTC and en-US so server-rendered dates are identical for every visitor (no hydration surprises). */
const publicDate = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

export const formatPublicDate = (iso: string | null | undefined) => (iso ? publicDate.format(new Date(iso)) : "");

export const formatReadingTime = (minutes: number) => `${Math.max(1, Math.round(minutes))} min read`;

/** First letter of the first word, for the author's avatar. Works for any script. */
export const initialOf = (name: string) => Array.from(name.trim())[0]?.toUpperCase() ?? "?";
