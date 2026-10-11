import { Aref_Ruqaa } from "next/font/google";

/**
 * Calligraphic Arabic, used for exactly one thing: the word in the list page's hero arch. It is
 * decoration, so it must never hold up the page: only the Arabic subset is fetched, and not preloaded
 * (it loads when the hero paints; until then the system's Arabic font stands in).
 *
 * The headline serif (Alegreya) stays in `lib/fonts.ts`, shared with the rest of the site.
 */
export const calligraphyFont = Aref_Ruqaa({
    subsets: ["arabic"],
    weight: "700",
    display: "swap",
    preload: false,
});
