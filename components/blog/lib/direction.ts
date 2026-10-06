/**
 * Text direction by the first strong letter, which is exactly the rule `dir="auto"` applies.
 *
 * Why it is computed here instead of leaving it to `dir="auto"`: the HTML spec makes `auto` ignore the
 * text of any descendant that has its own `dir`. A list whose items each carry `dir` would therefore
 * find no text of its own and fall back to left-to-right, putting the bullets on the wrong side of an
 * Arabic list. Setting an explicit direction on every block (leaf and container) is unambiguous.
 */

const LETTER = new RegExp("\\p{L}", "u");
/** Hebrew, Arabic (all blocks), Syriac, Thaana, N'Ko, Samaritan, Mandaic, and the Arabic presentation forms. */
const RTL_LETTER = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/** `"rtl"` / `"ltr"`, or `null` when there is no letter to decide on (digits, punctuation, empty). */
export function textDirection(text: string): "rtl" | "ltr" | null {
    for (const char of text) {
        if (!LETTER.test(char)) continue;
        return RTL_LETTER.test(char) ? "rtl" : "ltr";
    }
    return null;
}
