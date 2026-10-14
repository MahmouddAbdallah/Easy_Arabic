import { memo } from "react";

interface DateSeparatorProps {
    /** "Today", "Yesterday" or an absolute date. */
    label: string;
    /** Full date, shown as a tooltip (useful when the label is "Today" or "Yesterday"). */
    title: string;
    /** The day as YYYY-MM-DD. */
    dateTime: string;
}

/**
 * The chip that names a day. It stays at the top of the screen while that day scrolls by, then the next day's
 * chip takes its place.
 */
export const DateSeparator = memo(function DateSeparator({ label, title, dateTime }: DateSeparatorProps) {
    if (!label) return null;
    return (
        <div className="pointer-events-none sticky top-2 z-10 flex justify-center py-1.5">
            <time
                dateTime={dateTime}
                title={title}
                className="pointer-events-auto rounded-full border border-(--chat-line) bg-(--chat-surface) px-3 py-1 text-xs font-medium text-(--chat-ink-2) shadow-(--chat-shadow-sm)"
            >
                {label}
            </time>
        </div>
    );
});
