import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";
import { BLOG_BASE_PATH, blogIndexPath } from "../lib/constants";
import { pluralize } from "../lib/format";
import type { BlogTaxonomyItem } from "../lib/types";
import { FOCUS_RING, SHELL } from "./styles";

interface TagCloudProps {
    tags: readonly BlogTaxonomyItem[];
    /** The active tag's slug, if any. */
    activeTag?: string;
    basePath?: string;
}

/** Tags shown at once; the rest sit behind "Show all tags" (a native `<details>`, so no JavaScript). */
const VISIBLE_TAGS = 16;

function TagChip({ tag, active, basePath }: { tag: BlogTaxonomyItem; active: boolean; basePath: string }) {
    return (
        <Link
            href={active ? basePath : blogIndexPath({ tag: tag.slug }, basePath)}
            aria-current={active ? "page" : undefined}
            className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors motion-reduce:transition-none",
                active ? "border-brand bg-brand text-brand-foreground" : "border-border bg-card text-foreground hover:border-brand/50 hover:bg-brand-soft hover:text-brand",
                FOCUS_RING
            )}
        >
            <span dir="auto">{tag.name}</span>
            <span className={cn("text-xs tabular-nums", active ? "opacity-80" : "text-muted-foreground")}>{tag.count}</span>
            {active && <span className="sr-only">(selected, select again to clear)</span>}
        </Link>
    );
}

/**
 * Every tag in use, most used first, with how many articles carry it. It closes the page on a tinted
 * band: somebody who reached the end of the list is told, in a sentence, where else to go.
 */
export function TagCloud({ tags, activeTag, basePath = BLOG_BASE_PATH }: TagCloudProps) {
    if (tags.length === 0) return null;

    const visible = tags.slice(0, VISIBLE_TAGS);
    const more = tags.slice(VISIBLE_TAGS);

    return (
        <section aria-labelledby="blog-tags-title" className="border-t border-border/60 bg-brand-soft/60 py-14 md:py-20 dark:bg-brand-soft/50">
            <div className={SHELL}>
                <h2 id="blog-tags-title" className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                    Browse by tag
                </h2>
                <p className="mt-3 max-w-xl text-muted-foreground">Choose a tag to see every article that uses it. Choose it again to clear it.</p>

                <nav aria-label="Browse by tag" className="mt-8">
                    <ul role="list" className="flex flex-wrap gap-2.5">
                        {visible.map((tag) => (
                            <li key={tag.slug}>
                                <TagChip tag={tag} active={activeTag === tag.slug} basePath={basePath} />
                            </li>
                        ))}
                    </ul>

                    {more.length > 0 && (
                        <details className="group mt-4">
                            <summary
                                className={cn(
                                    "inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-md py-2 text-sm font-semibold text-brand select-none [&::-webkit-details-marker]:hidden",
                                    FOCUS_RING
                                )}
                            >
                                <span className="group-open:hidden">Show {pluralize(more.length, "more tag")}</span>
                                <span className="hidden group-open:inline">Show fewer tags</span>
                                <ChevronDown aria-hidden className="size-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
                            </summary>
                            <ul role="list" className="mt-3 flex flex-wrap gap-2.5">
                                {more.map((tag) => (
                                    <li key={tag.slug}>
                                        <TagChip tag={tag} active={activeTag === tag.slug} basePath={basePath} />
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}
                </nav>
            </div>
        </section>
    );
}
