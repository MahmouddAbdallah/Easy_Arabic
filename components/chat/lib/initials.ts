/**
 * Up to two letters for an avatar that has no photo: the first letters of the first two words ("Sara Ali" -> "SA"),
 * or the first two letters of a single word. Works per character (not per UTF-16 unit), so Arabic names and emoji
 * are never cut in half. "?" when there is no name at all.
 */
export function getInitials(name: string | null | undefined): string {
    const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    const letters =
        words.length > 1 ? [Array.from(words[0])[0], Array.from(words[1])[0]] : Array.from(words[0]).slice(0, 2);
    return letters.join("").toUpperCase();
}
