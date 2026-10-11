"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ActiveTabScrollerProps {
    /** Changes when the selected tab changes, so the row re-centres after each navigation. */
    activeKey: string;
    className?: string;
    children: ReactNode;
}

/**
 * The topic tabs scroll sideways on a phone, and the selected one may be off to the side. This brings it
 * into view once the page has loaded. That is all it does: the tabs are plain links rendered on the
 * server, so with no JavaScript they work exactly the same (the row simply starts at its beginning).
 */
export function ActiveTabScroller({ activeKey, className, children }: ActiveTabScrollerProps) {
    const box = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const row = box.current;
        const active = row?.querySelector<HTMLElement>('[aria-current="page"]');
        if (!row || !active) return;

        // Pixel distances between the two boxes, so it holds in either text direction.
        const rowRect = row.getBoundingClientRect();
        const activeRect = active.getBoundingClientRect();
        const shift = activeRect.left - rowRect.left - (rowRect.width - activeRect.width) / 2;
        if (Math.abs(shift) > 1) row.scrollBy({ left: shift });
    }, [activeKey]);

    return (
        <div ref={box} className={className}>
            {children}
        </div>
    );
}
