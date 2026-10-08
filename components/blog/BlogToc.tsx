import { TOC_MIN_HEADINGS } from "./lib/constants";
import type { BlogHeading } from "./lib/content";

/** "On this page": links to the post's headings. Pure HTML (<details>), no JavaScript. Hidden for short posts. */
export function BlogToc({ headings }: { headings: BlogHeading[] }) {
    if (headings.length < TOC_MIN_HEADINGS) return null;

    return (
        <nav aria-label="Table of contents" className="mb-8 rounded-xl border border-border bg-card px-5 py-3.5">
            <details >
                <summary className="cursor-pointer select-none text-sm font-semibold text-foreground">On this page</summary>
                <ol className="mt-3 space-y-1.5 text-[0.95rem] leading-snug">
                    {headings.map((heading) => (
                        <li key={heading.id} dir="auto" style={{ paddingInlineStart: `${(heading.level - 2) * 1}rem` }}>
                            <a href={`#${heading.id}`} className="text-muted-foreground underline-offset-4 transition-colors hover:text-brand hover:underline">
                                {heading.text}
                            </a>
                        </li>
                    ))}
                </ol>
            </details>
        </nav>
    );
}
