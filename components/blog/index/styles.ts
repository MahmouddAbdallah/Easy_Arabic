/**
 * Class strings shared by the list page's sections, so the sections line up with each other and with
 * the site's navbar (`max-w-7xl`, `px-4 md:px-6`). Logical properties only: everything mirrors.
 */

/** The page column. Same edges as the navbar above it. */
export const SHELL = "mx-auto w-full max-w-7xl px-4 md:px-6";

/** Keyboard focus, the same brand ring the rest of the Blog uses. */
export const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-brand/50";

/**
 * Gold for small text on the always-dark teal panels. The page's `--gold` is tuned for fills and large
 * type (about 4:1 on this teal); this is its dark-mode sibling, which reads at 6:1.
 */
export const GOLD_ON_DEEP = "text-[#e6bd66]";

/** The two buttons of the hero, on the dark teal panel. */
export const BUTTON_BASE =
    "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-6 text-sm font-bold transition-[background-color,transform] active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 sm:w-auto";
export const BUTTON_GOLD = `${BUTTON_BASE} bg-gold text-[#2a1f04] hover:bg-[#d3a13d] ${FOCUS_RING} focus-visible:ring-offset-2 focus-visible:ring-offset-brand-deep`;
export const BUTTON_ON_DEEP = `${BUTTON_BASE} border border-white/25 bg-white/5 text-white hover:bg-white/15 ${FOCUS_RING} focus-visible:ring-white/60`;
