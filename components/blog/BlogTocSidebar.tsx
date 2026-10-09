"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from 'cn'
import { textDirection } from "./lib/direction";

/** Plain data only (no post nodes), so it is cheap to hand from the server component to this one. */
export interface TocItem {
    id: string;
    text: string;
    level: number;
}

/**
 * How far below the top of the screen a heading counts as "the one being read". It has to clear the
 * sticky site header (4rem) and be larger than the 6rem scroll margin headings get when you jump to
 * them (see blog-prose.css), so a heading you just jumped to is always the highlighted one.
 */
const READING_LINE = 112;

/** The last heading that has reached the reading line, or none while the reader is still in the intro. */
function headingAtReadingLine(ids: string[]): string | null {
    let current: string | null = null;
    for (const id of ids) {
        const element = document.getElementById(id);
        if (!element) continue;
        if (element.getBoundingClientRect().top > READING_LINE) break;
        current = id;
    }
    return current;
}

function scrollToTop() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
}

/**
 * "On this page" as a quiet rail beside the article: it sticks under the site header and marks the
 * section being read. Without JavaScript it is still a working list of anchor links; the highlight
 * is the only thing that needs a script. Desktop only (the caller hides it below `lg`).
 */
export function BlogTocSidebar({ items, className }: { items: TocItem[]; className?: string }) {
    const [activeId, setActiveId] = useState<string | null>(null);

    useEffect(() => {
        const ids = items.map((item) => item.id);
        let frame = 0;

        const update = () => {
            frame = 0;
            const next = headingAtReadingLine(ids);
            setActiveId((previous) => (previous === next ? previous : next));
        };
        // One measurement per animation frame, however many scroll events fire.
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };

        schedule();
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        return () => {
            window.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [items]);

    return (
        <nav aria-labelledby="blog-toc-title" className={cn("sticky top-24", className)}>
            <p id="blog-toc-title" className="mb-3 text-sm font-semibold text-foreground">
                On this page
            </p>

            <div className="max-h-[calc(100svh-15rem)] overflow-y-auto overscroll-contain pe-2 [scrollbar-width:thin]">
                {/* The rail is this list's own start border; the active link paints a brand-coloured stripe over it. */}
                <ol className="border-s border-border">
                    {items.map((item) => (
                        <li key={item.id}>
                            <a
                                href={`#${item.id}`}
                                aria-current={item.id === activeId ? "location" : undefined}
                                // Each level steps in a little; the link itself keeps the page's direction so the rail never flips side.
                                style={{ paddingInlineStart: `${1 + (item.level - 2) * 0.75}rem` }}
                                className="-ms-px block rounded-e-md border-s-2 border-transparent py-1.5 pe-2 text-[0.8125rem] leading-snug text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-inset aria-[current=location]:border-brand aria-[current=location]:font-medium aria-[current=location]:text-foreground motion-reduce:transition-none"
                            >
                                <span dir={textDirection(item.text) ?? undefined} className="block">
                                    {item.text}
                                </span>
                            </a>
                        </li>
                    ))}
                </ol>
            </div>

            <button
                type="button"
                onClick={scrollToTop}
                className="mt-5 inline-flex min-h-9 items-center gap-1.5 rounded-md text-[0.8125rem] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/50 motion-reduce:transition-none"
            >
                <ArrowUp aria-hidden className="size-3.5" />
                Back to top
            </button>
        </nav>
    );
}
