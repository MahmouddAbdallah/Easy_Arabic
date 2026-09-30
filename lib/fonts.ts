import { Alegreya } from "next/font/google";

/**
 * Display serif for headlines and large figures on the Home page and the
 * Dashboard. Body and UI text keep the app-wide sans (Inter / Geist).
 * Alegreya has a calligraphic rhythm that suits a language-learning brand.
 */
export const displayFont = Alegreya({
  subsets: ["latin"],
  variable: "--font-alegreya",
  display: "swap",
});
