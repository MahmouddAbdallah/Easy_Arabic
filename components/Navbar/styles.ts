/** Keyboard focus ring shared by every navbar control. Brand-tinted, matches the dashboard. */
export const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-brand/50"

/** Square, ghost-style icon button (theme toggle, menu, close). 40px keeps a comfortable touch target. */
export const iconButtonClass = [
    "grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground",
    "transition-[color,background-color,transform] duration-150 motion-reduce:transition-none",
    "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
    "active:scale-95 motion-reduce:active:scale-100",
    focusRing,
].join(" ")
