import { ArrowDown } from "lucide-react";
import { cn } from "cn";
import { formatPublicDate, pluralize } from "../lib/format";
import { HeroArch } from "./HeroArch";
import { StarMark } from "./Ornaments";
import { BUTTON_GOLD, BUTTON_ON_DEEP, SHELL } from "./styles";

export interface BlogHeroProps {
    /** The page's name, in the small badge above the headline. */
    eyebrow: string;
    /** The headline (the page's `<h1>`). */
    title: string;
    description?: string;
    /** Real figures from the published posts; the hero states them in a sentence, nothing is made up. */
    totalPublished: number;
    topicCount: number;
    /** ISO date of the newest published post. */
    latestPublishedAt: string | null;
    /** Whether a lead story follows (the first button jumps to it). */
    hasFeatured: boolean;
    /** Whether the category bar is on the page (the second button jumps to it). */
    hasTopics: boolean;
    className?: string;
}

/**
 * The front page's opening: a message, a way in, and one picture. Deep teal in both themes (it is the
 * brand's own colour, not a theme colour), the headline in the display serif, the arch as the single
 * ornamental moment. The only motion on the page is this section arriving once.
 */
export function BlogHero({ eyebrow, title, description, totalPublished, topicCount, latestPublishedAt, hasFeatured, hasTopics, className }: BlogHeroProps) {
    return (
        <section aria-labelledby="blog-hero-title" className={cn("relative isolate overflow-hidden bg-brand-deep text-white", className)}>
            {/* Star lattice, faded out toward the edges so it frames the arch instead of covering the page. */}
            <div aria-hidden className="absolute inset-0 -z-10 mask-[radial-gradient(ellipse_at_72%_55%,black,transparent_68%)]">
                <div className="absolute inset-0 pattern-khatam text-gold opacity-[0.13]" style={{ ["--pattern-size" as string]: "64px" }} />
            </div>
            <div aria-hidden className="absolute -top-40 inset-s-1/3 -z-10 h-[30rem] w-[34rem] rounded-full bg-brand/30 blur-[130px]" />

            <div className={cn(SHELL, "grid items-end lg:grid-cols-12 lg:gap-x-12")}>
                <div className="animate-ea-rise pt-12 pb-12 motion-reduce:animate-none lg:col-span-7 lg:pt-24 lg:pb-24">
                    <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm font-medium text-white/90">
                        <StarMark className="size-3.5 text-gold" />
                        {eyebrow}
                    </p>

                    <h1
                        id="blog-hero-title"
                        className="mt-6 max-w-2xl font-display text-[2.75rem] leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl lg:text-[4.5rem]"
                    >
                        {title}
                    </h1>

                    {description && <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">{description}</p>}

                    {hasFeatured && (
                        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                            <a href="#featured" className={BUTTON_GOLD}>
                                Read the featured article
                                <ArrowDown aria-hidden className="size-4" />
                            </a>
                            {hasTopics && (
                                <a href="#topics" className={BUTTON_ON_DEEP}>
                                    Browse by topic
                                </a>
                            )}
                        </div>
                    )}

                    {/* The one place numbers appear, and they are counted from the real posts. The gold stub on the rule is the Blog's accent (see BlogMeta). */}
                    <p className="relative mt-10 max-w-xl border-t border-white/15 pt-5 text-sm leading-relaxed text-white/75">
                        <span aria-hidden className="absolute inset-s-0 -top-px h-0.5 w-14 rounded-full bg-gold" />
                        {totalPublished > 0 ? (
                            <>
                                {pluralize(totalPublished, "article")}
                                {topicCount > 0 && <> across {pluralize(topicCount, "topic")}</>}.
                                {latestPublishedAt && (
                                    <>
                                        {" "}
                                        The newest was published on <time dateTime={latestPublishedAt}>{formatPublicDate(latestPublishedAt)}</time>.
                                    </>
                                )}
                            </>
                        ) : (
                            "The first article is on its way. Check back soon."
                        )}
                    </p>
                </div>

                <div className="flex animate-ea-settle justify-center pt-10 [animation-delay:120ms] motion-reduce:animate-none lg:col-span-5 lg:justify-end lg:pt-20">
                    <HeroArch />
                </div>
            </div>
        </section>
    );
}
