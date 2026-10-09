import { cn } from 'cn'

/** First + last initial ("Mahmoud Ragab" -> "MR"). Iterates code points so non-Latin names stay intact. */
export function getInitials(name?: string | null): string {
    const words = (name ?? "").trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) return "?"
    const first = [...words[0]]
    if (words.length === 1) return first.slice(0, 2).join("").toUpperCase()
    const last = [...words[words.length - 1]]
    return (first[0] + last[0]).toUpperCase()
}

export function UserAvatar({ name, className }: { name?: string | null; className?: string }) {
    return (
        <span
            aria-hidden
            className={cn(
                "grid shrink-0 select-none place-items-center rounded-full bg-brand-soft font-semibold text-brand ring-1 ring-brand/20",
                className
            )}
        >
            {getInitials(name)}
        </span>
    )
}
