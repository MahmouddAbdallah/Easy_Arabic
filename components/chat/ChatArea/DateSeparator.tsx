import { memo } from "react";

interface DateSeparatorProps {
    /** "Today", "Yesterday" or an absolute date. */
    label: string;
    /** Full date, shown as a tooltip (useful when the label is "Today" or "Yesterday"). */
    title: string;
    /** The day as YYYY-MM-DD. */
    dateTime: string;
}

/** The small centered pill that opens each day of the conversation. */
export const DateSeparator = memo(function DateSeparator({ label, title, dateTime }: DateSeparatorProps) {
    return (
        <div className="flex items-center justify-center my-4">
            <time
                dateTime={dateTime}
                title={title}
                className="text-[10px] font-semibold tracking-wide text-muted-foreground/70 bg-muted/40 px-3.5 py-1 rounded-full border border-border/30 backdrop-blur-md shadow-xs"
            >
                {label}
            </time>
        </div>
    );
});
