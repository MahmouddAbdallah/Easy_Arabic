import { Fragment, type ReactNode } from "react";
import { cn } from "cn";
import type { HighlightRange } from "../../lib/chatSearch";

interface HighlightedTextProps {
    text: string;
    /** Sorted, non-overlapping `[start, end)` ranges of `text`. Anything outside the text is ignored. */
    ranges: readonly HighlightRange[];
    className?: string;
}

/**
 * `text` with the given stretches marked, the way a browser marks what "find in page" found.
 * Amber with dark text on purpose: it stays readable on a light bubble, a dark bubble and the
 * primary-coloured bubbles of your own messages alike.
 */
export function HighlightedText({ text, ranges, className }: HighlightedTextProps) {
    if (ranges.length === 0) return <>{text}</>;

    const parts: ReactNode[] = [];
    let cursor = 0;

    ranges.forEach(([start, end], index) => {
        const from = Math.max(start, cursor);
        const to = Math.min(end, text.length);
        if (from >= to) return; // out of order, overlapping or outside the text: skip, never throw

        if (from > cursor) parts.push(<Fragment key={`t${index}`}>{text.slice(cursor, from)}</Fragment>);
        parts.push(
            <mark
                key={`m${index}`}
                className={cn("rounded-[3px] bg-amber-300 px-px text-amber-950 [-webkit-box-decoration-break:clone] [box-decoration-break:clone]", className)}
            >
                {text.slice(from, to)}
            </mark>
        );
        cursor = to;
    });

    if (cursor < text.length) parts.push(<Fragment key="tail">{text.slice(cursor)}</Fragment>);
    return <>{parts}</>;
}
