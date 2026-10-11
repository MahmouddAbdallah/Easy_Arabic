import { cn } from "cn";
import type { BlogImage } from "../lib/types";
import { cloudinaryImageVariant, cloudinarySrcSet } from "../lib/url";
import { CoverPlaceholder } from "./Ornaments";

interface CoverImageProps {
    cover: BlogImage | null;
    /** Widths Cloudinary is asked for (never upscaled). The middle one is the plain `src`. */
    widths: readonly number[];
    sizes: string;
    /** Above the fold: fetch now instead of when scrolled near. */
    eager?: boolean;
    className?: string;
}

/**
 * A post's cover, or the placeholder when it has none. Fills its parent, which must be positioned and
 * clip its overflow; the parent sets the shape (aspect ratio, corners), so one image serves every card.
 */
export function CoverImage({ cover, widths, sizes, eager = false, className }: CoverImageProps) {
    if (!cover) return <CoverPlaceholder />;

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={cloudinaryImageVariant(cover.url, widths[Math.floor(widths.length / 2)])}
            srcSet={cloudinarySrcSet(cover.url, widths)}
            sizes={sizes}
            alt={cover.alt}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className={cn("absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100", className)}
        />
    );
}
