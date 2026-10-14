import { IBM_Plex_Sans_Arabic } from "next/font/google";

/**
 * The chat's own typeface. One family covers Arabic and Latin, so a message that mixes the two (as this chat's
 * messages often do) keeps one rhythm, one weight and one x-height instead of falling back to a different font
 * for each script. It is applied through a CSS variable on the chat root only.
 */
export const chatFont = IBM_Plex_Sans_Arabic({
    subsets: ["arabic", "latin"],
    weight: ["400", "500", "600"],
    display: "swap",
    variable: "--chat-font-face",
});
