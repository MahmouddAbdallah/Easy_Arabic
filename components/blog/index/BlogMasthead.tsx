import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "cn";
import { textDirection } from "../lib/direction";
import { StarMark } from "./Ornaments";
import { FOCUS_RING, GOLD_ON_DEEP, SHELL } from "./styles";

export interface BlogMastheadProps {
    /** What the page is a list of: "Category", "Tag" or "Archive". */
    kind: string;
    /** The category or tag name, or "All articles" for a later page. A name may be Arabic. */
    title: string;
    /** One line under the title, e.g. "5 articles". */
    summary: string;
    /** Where "All articles" leads. */
    backHref: string;
    className?: string;
}

/**
 * The compact opening for every view that is not the front page (a category, a tag, page 2 and beyond):
 * the same deep teal as the hero, a fraction of its height, because somebody who filtered wants the
 * articles, not the welcome. It still says exactly where you are and how to get back.
 */
export function BlogMasthead({ kind, title, summary, backHref, className }: BlogMastheadProps) {
    const direction = textDirection(title) ?? "ltr";

    return (
        // The whole masthead takes the direction of the title, as the article page does: an Arabic category
        // mirrors (back link, label, title, count and the star), instead of one right-aligned line adrift in a left-aligned block.
        <section dir={direction} aria-labelledby="blog-masthead-title" className={cn("relative isolate overflow-hidden bg-brand-deep text-white", className)}>
            <div aria-hidden className="absolute inset-0 -z-10 mask-[linear-gradient(to_left,black,transparent_70%)] rtl:mask-[linear-gradient(to_right,black,transparent_70%)]">
                <div className="absolute inset-0 pattern-khatam text-gold opacity-[0.12]" style={{ ["--pattern-size" as string]: "56px" }} />
            </div>
            <StarMark className="absolute inset-e-8 top-1/2 -z-10 hidden size-56 -translate-y-1/2 text-gold/10 md:block lg:inset-e-16" />

            <div className={cn(SHELL, "py-10 md:py-14")}>
                <Link
                    href={backHref}
                    className={cn("-ms-2 inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm text-white/75 transition-colors hover:text-white motion-reduce:transition-none", FOCUS_RING, "focus-visible:ring-white/60")}
                >
                    <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
                    All articles
                </Link>

                <p className={cn("mt-6 text-sm font-medium", GOLD_ON_DEEP)}>{kind}</p>
                <h1
                    id="blog-masthead-title"
                    className="mt-2 max-w-4xl font-display text-4xl leading-[1.1] font-bold tracking-tight text-balance wrap-break-word md:text-6xl [&[dir=rtl]]:leading-[1.4] [&[dir=rtl]]:tracking-normal"
                >
                    {title}
                </h1>
                <p className="mt-4 text-lg text-white/75">{summary}</p>
            </div>
        </section>
    );
}
