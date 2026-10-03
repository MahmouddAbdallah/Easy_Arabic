import type { BusinessHourRecord, ContactInfoFields } from "./types";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** "" / whitespace → null, otherwise the trimmed string. Used before writing optional columns. */
export const emptyToNull = (value: string | null | undefined): string | null => {
    const v = value?.trim();
    return v ? v : null;
};

const digitsOnly = (value: string) => value.replace(/\D/g, "");

/** `tel:` link: keeps a leading + and digits only. */
export const phoneHref = (phone: string) => {
    const trimmed = phone.trim();
    return `tel:${trimmed.startsWith("+") ? "+" : ""}${digitsOnly(trimmed)}`;
};

/** WhatsApp numbers are stored as digits only (country code included), as wa.me expects. */
export const normalizeWhatsappNumber = (value: string | null | undefined): string | null => {
    const digits = digitsOnly(value ?? "");
    return digits ? digits : null;
};

export const whatsappHref = (number: string, message?: string) =>
    `https://wa.me/${digitsOnly(number)}${message?.trim() ? `?text=${encodeURIComponent(message.trim())}` : ""}`;

/** Single-line postal address, skipping empty parts. */
export const formatAddressLines = (info: Pick<ContactInfoFields, "addressLine1" | "addressLine2" | "city" | "stateRegion" | "postalCode" | "country">) => {
    const line1 = [info.addressLine1, info.addressLine2].filter(Boolean).join(", ");
    const line2 = [info.city, info.stateRegion, info.postalCode].filter(Boolean).join(", ");
    return [line1, line2, info.country].filter(Boolean);
};

/** Keyless OpenStreetMap embed centred on the pin. */
export const mapEmbedUrl = (lat: number, lng: number, delta = 0.004) => {
    const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].map((n) => n.toFixed(6)).join("%2C");
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
};

export const mapDirectionsUrl = (lat: number, lng: number) =>
    `https://www.google.com/maps/search/?api=1&query=${lat}%2C${lng}`;

/** "21:00" → "9:00 PM" (locale-independent so server and client render identically). */
export const formatClock = (hhmm: string | null) => {
    if (!hhmm) return "";
    const [h, m] = hhmm.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
};

export const formatHoursRange = (day: BusinessHourRecord) =>
    day.isOpen && day.opensAt && day.closesAt ? `${formatClock(day.opensAt)} – ${formatClock(day.closesAt)}` : "Closed";

/** Short "@handle" style label from a profile URL, e.g. https://x.com/easyarabic → "@easyarabic". */
export const handleFromUrl = (url: string) => {
    try {
        const parts = new URL(url).pathname.split("/").filter(Boolean);
        const last = parts[parts.length - 1];
        return last ? `@${last}` : new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
};

/** Current weekday index (0 = Sunday) and "HH:MM" in the given IANA time zone. */
export const nowInTimezone = (timezone: string, date = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    return { dayOfWeek: weekdayIndex, time: `${get("hour")}:${get("minute")}` };
};

export const isOpenNow = (hours: BusinessHourRecord[], timezone: string, date = new Date()) => {
    try {
        const { dayOfWeek, time } = nowInTimezone(timezone, date);
        const today = hours.find((h) => h.dayOfWeek === dayOfWeek);
        if (!today?.isOpen || !today.opensAt || !today.closesAt) return { dayOfWeek, open: false };
        return { dayOfWeek, open: time >= today.opensAt && time < today.closesAt };
    } catch {
        return { dayOfWeek: -1, open: false };
    }
};
