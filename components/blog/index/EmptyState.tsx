import Link from "next/link";
import { StarMark } from "./Ornaments";
import { FOCUS_RING } from "./styles";
import { cn } from "cn";

interface EmptyStateProps {
    /** A category or tag matched nothing (a stale link, a retired topic), as opposed to the blog being empty. */
    filtered: boolean;
    /** Where "See all articles" leads. */
    allHref: string;
}

/** Nothing to list. Says why, and when there is somewhere to go, offers it. */
export function EmptyState({ filtered, allHref }: EmptyStateProps) {
    return (
        <div className="rounded-3xl border border-dashed border-border px-6 py-20 text-center">
            <StarMark className="mx-auto size-8 text-gold" />
            <p className="mt-5 font-display text-3xl font-bold tracking-tight text-foreground">{filtered ? "No articles match that topic" : "No articles yet"}</p>
            <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
                {filtered ? "It may have been renamed or retired. Everything we have published is one click away." : "The first one is on its way. Check back soon."}
            </p>
            {filtered && (
                <Link
                    href={allHref}
                    className={cn("mt-8 inline-flex h-11 items-center rounded-xl bg-brand px-6 text-sm font-bold text-brand-foreground transition-opacity hover:opacity-90 motion-reduce:transition-none", FOCUS_RING, "focus-visible:ring-offset-2 focus-visible:ring-offset-background")}
                >
                    See all articles
                </Link>
            )}
        </div>
    );
}
