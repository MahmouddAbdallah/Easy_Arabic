import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "cn";
import { BLOG_BASE_PATH, blogIndexPath } from "../lib/constants";
import type { BlogTaxonomyItem } from "../lib/types";
import { ActiveTabScroller } from "./ActiveTabScroller";
import { FOCUS_RING, SHELL } from "./styles";

interface TopicNavProps {
    categories: readonly BlogTaxonomyItem[];
    /** Every published post, for the "All articles" count. */
    totalPublished: number;
    /** The active category's slug, if any. */
    category?: string;
    /** The active tag, if any: shown at the end of the row, with a way to clear it. */
    activeTag?: BlogTaxonomyItem;
    basePath?: string;
}

const tab =
    "relative inline-flex h-12 shrink-0 items-center gap-2 px-3 text-[0.95rem] font-medium whitespace-nowrap transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full motion-reduce:transition-none focus-visible:ring-inset " +
    FOCUS_RING;

/**
 * The category bar: underlined tabs in one row that scrolls sideways on a phone and stays pinned under
 * the site's navbar while the articles scroll past, so switching topic is always one tap away. They are
 * ordinary links (`aria-current` marks the selected one); one filter applies at a time.
 */
export function TopicNav({ categories, totalPublished, category, activeTag, basePath = BLOG_BASE_PATH }: TopicNavProps) {
    const allActive = !category && !activeTag;

    return (
        <div id="topics" className="sticky top-16 z-30 scroll-mt-16 border-b border-border/70 bg-background/85 backdrop-blur-lg">
            <div className={SHELL}>
                <div className="relative">
                    <nav aria-label="Browse by category">
                        <ActiveTabScroller activeKey={`${category ?? ""}|${activeTag?.slug ?? ""}`} className="hide-scrollbar -mx-3 overflow-x-auto">
                            {/* The end padding (phones) keeps the last tab clear of the scroll-hint fade when the row is scrolled to its end. */}
                            <ul role="list" className="flex w-max min-w-full items-center pe-10 md:pe-0">
                                <li>
                                    <Link
                                        href={basePath}
                                        aria-current={allActive ? "page" : undefined}
                                        className={cn(tab, allActive ? "text-foreground after:bg-gold" : "text-muted-foreground after:bg-transparent hover:text-foreground hover:after:bg-border")}
                                    >
                                        All articles
                                        <span className="text-xs tabular-nums text-muted-foreground">{totalPublished}</span>
                                    </Link>
                                </li>

                                {categories.map((item) => {
                                    const active = category === item.slug;
                                    return (
                                        <li key={item.slug}>
                                            <Link
                                                href={blogIndexPath({ category: item.slug }, basePath)}
                                                aria-current={active ? "page" : undefined}
                                                className={cn(tab, active ? "text-foreground after:bg-gold" : "text-muted-foreground after:bg-transparent hover:text-foreground hover:after:bg-border")}
                                            >
                                                <span dir="auto">{item.name}</span>
                                                <span className="text-xs tabular-nums text-muted-foreground">{item.count}</span>
                                            </Link>
                                        </li>
                                    );
                                })}

                                {activeTag && (
                                    <li className="ms-3 shrink-0">
                                        <Link
                                            href={basePath}
                                            aria-current="page"
                                            className={cn("inline-flex h-9 items-center gap-2 rounded-full border border-gold/50 bg-gold-soft px-3.5 text-sm font-medium whitespace-nowrap text-gold-ink", FOCUS_RING)}
                                        >
                                            <span>
                                                Tag: <span dir="auto">{activeTag.name}</span>
                                            </span>
                                            <X aria-hidden className="size-3.5" />
                                            <span className="sr-only">Clear tag filter</span>
                                        </Link>
                                    </li>
                                )}
                            </ul>
                        </ActiveTabScroller>
                    </nav>

                    {/* Hints that the row scrolls, on phones only. */}
                    <div aria-hidden className="pointer-events-none absolute inset-y-0 inset-e-0 w-10 bg-linear-to-l from-background to-transparent md:hidden rtl:bg-linear-to-r" />
                </div>
            </div>
        </div>
    );
}
