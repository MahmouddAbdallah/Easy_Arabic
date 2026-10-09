import { ChevronDown, ListTree } from "lucide-react";
import { cn } from "@/lib/utils";
import { BlogTocSidebar } from "./BlogTocSidebar";
import { TOC_MIN_HEADINGS } from "./lib/constants";
import type { BlogHeading } from "./lib/content";
import { textDirection } from "./lib/direction";

interface BlogTocProps {
    headings: BlogHeading[];
    /**
     * `inline`: a collapsible card in the reading flow (phones, tablets, the dashboard preview). Pure HTML, no JavaScript.
     * `sidebar`: the sticky rail beside the article on large screens.
     */
    variant?: "inline" | "sidebar";
    className?: string;
}

/** "On this page": links to the post's headings. Hidden for short posts. */
export function BlogToc({ headings, variant = "inline", className }: BlogTocProps) {
    if (headings.length < TOC_MIN_HEADINGS) return null;

    if (variant === "sidebar") {
        return <BlogTocSidebar className={className} items={headings.map(({ id, text, level }) => ({ id, text, level }))} />;
    }

    return (
        <nav aria-label="Table of contents" className={cn("mb-10", className)}>
            <details className="group rounded-xl border border-border bg-card">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl px-4 text-[0.95rem] font-semibold text-foreground outline-none select-none focus-visible:ring-2 focus-visible:ring-brand/50 [&::-webkit-details-marker]:hidden">
                    <ListTree aria-hidden className="size-4 text-brand" />
                    On this page
                    <ChevronDown
                        aria-hidden
                        className="ms-auto size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                    />
                </summary>

                <ol className="border-t border-border p-2">
                    {headings.map((heading) => (
                        <li key={heading.id}>
                            <a
                                href={`#${heading.id}`}
                                // Each level steps in a little; the text itself reads in its own direction (below).
                                style={{ paddingInlineStart: `${0.75 + (heading.level - 2) * 1}rem` }}
                                className="block rounded-lg py-2.5 pe-3 text-[0.95rem] leading-snug text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-inset motion-reduce:transition-none"
                            >
                                <span dir={textDirection(heading.text) ?? undefined} className="block">
                                    {heading.text}
                                </span>
                            </a>
                        </li>
                    ))}
                </ol>
            </details>
        </nav>
    );
}
