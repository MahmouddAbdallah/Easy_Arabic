import { cn } from "cn";

/**
 * The eight-pointed star (two squares, one turned by 45 degrees) that the whole site's pattern is built
 * from (`.pattern-khatam` in globals.css). Decorative: always `aria-hidden`.
 */
export function StarMark({ className }: { className?: string }) {
    return (
        <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className={cn("shrink-0", className)}>
            <path d="M23 12 19.778 15.222V19.778H15.222L12 23 8.778 19.778H4.222V15.222L1 12 4.222 8.778V4.222H8.778L12 1 15.222 4.222H19.778V8.778Z" />
        </svg>
    );
}

/**
 * What a post without a cover image shows: the brand's star lattice on deep teal, with one star in the
 * middle, so a text-only post still looks chosen rather than broken. Fills its (positioned) parent.
 */
export function CoverPlaceholder({ className }: { className?: string }) {
    return (
        <div aria-hidden className={cn("absolute inset-0 bg-brand-deep", className)}>
            <div className="absolute inset-0 pattern-khatam text-gold opacity-20" style={{ ["--pattern-size" as string]: "56px" }} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--brand-deep)_0%,transparent_65%)]" />
            <StarMark className="absolute inset-0 m-auto size-1/5 min-h-8 min-w-8 text-gold" />
        </div>
    );
}
