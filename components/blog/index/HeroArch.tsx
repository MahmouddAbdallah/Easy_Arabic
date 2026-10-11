import Image from "next/image";
import { cn } from "cn";
import { calligraphyFont } from "../lib/fonts";

/** The site's own hero photograph (public/assets), cropped by the arch. */
const PHOTO = "/assets/hero.jpg";

/**
 * The hero's picture: a niche, in the shape of a prayer-hall arch, framing the brand photograph, with the
 * word "Iqra" (اقرأ, "read": the first word of the Quran's first revelation) set in calligraphy at its foot.
 * The arch stands on the bottom edge of the hero, like a doorway into the articles below it.
 *
 * Purely decorative (`aria-hidden`), so the page's meaning never depends on it. The two outlines are
 * concentric: `rounded-t-full` on a box makes a semicircle of half its width, so a wider box is a
 * bigger, matching arch.
 */
export function HeroArch({ className }: { className?: string }) {
    return (
        <div aria-hidden className={cn("relative w-60 sm:w-72 lg:w-full lg:max-w-88", className)}>
            <div className="absolute -inset-x-4 -top-4 bottom-0 rounded-t-full border border-b-0 border-gold/55" />
            <div className="absolute -inset-x-8 -top-8 bottom-0 rounded-t-full border border-b-0 border-gold/25" />

            <div className="relative aspect-3/4 overflow-hidden rounded-t-full bg-brand">
                {/* The next/image docs: for an image above the fold use `loading="eager"` + `fetchPriority="high"`, not `priority`. */}
                <Image
                    src={PHOTO}
                    alt=""
                    fill
                    loading="eager"
                    fetchPriority="high"
                    sizes="(min-width: 1024px) 352px, 288px"
                    className="object-cover"
                />
                {/* Tints the photo into the brand's teal, then darkens its foot so the word reads. */}
                <div className="absolute inset-0 bg-brand-deep/35 mix-blend-multiply" />
                <div className="absolute inset-0 bg-linear-to-t from-brand-deep via-brand-deep/60 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-4 pb-7 text-center sm:pb-9">
                    <span lang="ar" dir="rtl" className={cn(calligraphyFont.className, "text-[5rem] leading-[1.15] text-gold sm:text-[6.5rem]")}>
                        اقرأ
                    </span>
                    <span className="mt-1 text-sm text-white/80">Iqra: read</span>
                </div>
            </div>
        </div>
    );
}
