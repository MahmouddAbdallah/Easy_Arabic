import { BLOG_LIMITS } from "./constants";
import type { EmbedProvider } from "./types";

/* ------------------------------------------------------------- Link safety */

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * The URL to put in an `href`, or `null` if it isn't safe. Allows http(s), mailto, tel, in-site paths
 * (`/x`) and anchors (`#x`); everything else (`javascript:`, `data:`, `vbscript:` …) is refused.
 * Used when content is saved AND when it is rendered, so neither side trusts the other.
 */
export function safeHref(input: unknown): string | null {
    if (typeof input !== "string") return null;
    const value = input.trim();
    if (!value || value.length > BLOG_LIMITS.url) return null;
    if (/[\u0000-\u001F\u007F]/.test(value)) return null;

    if (value.startsWith("#")) return value;
    // A single leading slash is an in-site path; "//host" is a protocol-relative URL to another site.
    if (value.startsWith("/") && !value.startsWith("//")) return value;

    try {
        const url = new URL(value);
        return SAFE_PROTOCOLS.has(url.protocol) ? value : null;
    } catch {
        return null;
    }
}

/** True for absolute https URLs. Media (images, videos) must be https so a page never mixes content. */
export function isHttpsUrl(input: unknown): input is string {
    if (typeof input !== "string" || input.length === 0 || input.length > BLOG_LIMITS.url) return false;
    try {
        return new URL(input).protocol === "https:";
    } catch {
        return false;
    }
}

/** Links to other sites open in a new tab; in-site paths and anchors don't. */
export const isExternalHref = (href: string) => /^https?:\/\//i.test(href);

/* ----------------------------------------------------------- Video embeds */

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;

export const isValidVideoId = (provider: EmbedProvider, id: string) =>
    provider === "youtube" ? YOUTUBE_ID.test(id) : VIMEO_ID.test(id);

/**
 * Recognises the common YouTube and Vimeo link shapes (watch, share, shorts, live, embed) and returns
 * the provider and video id. Only the id is ever stored: the embed URL is rebuilt from it on render,
 * so an arbitrary URL can never end up in an `<iframe src>`.
 */
export function parseVideoUrl(input: string): { provider: EmbedProvider; videoId: string } | null {
    let url: URL;
    try {
        url = new URL(input.trim());
    } catch {
        return null;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;

    const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
    const parts = url.pathname.split("/").filter(Boolean);

    if (host === "youtu.be") {
        return parts[0] && YOUTUBE_ID.test(parts[0]) ? { provider: "youtube", videoId: parts[0] } : null;
    }

    if (host === "youtube.com" || host === "youtube-nocookie.com") {
        const fromQuery = url.searchParams.get("v");
        if (fromQuery && YOUTUBE_ID.test(fromQuery)) return { provider: "youtube", videoId: fromQuery };
        if (["embed", "shorts", "live", "v"].includes(parts[0]) && parts[1] && YOUTUBE_ID.test(parts[1])) {
            return { provider: "youtube", videoId: parts[1] };
        }
        return null;
    }

    if (host === "vimeo.com" || host === "player.vimeo.com") {
        // vimeo.com/123456789, vimeo.com/channels/x/123456789, player.vimeo.com/video/123456789
        const id = parts.find((part) => VIMEO_ID.test(part));
        return id ? { provider: "vimeo", videoId: id } : null;
    }

    return null;
}

export function embedUrl(provider: EmbedProvider, videoId: string): string {
    return provider === "youtube"
        ? `https://www.youtube-nocookie.com/embed/${videoId}`
        : `https://player.vimeo.com/video/${videoId}?dnt=1`;
}

export const embedThumbnail = (provider: EmbedProvider, videoId: string): string | null =>
    provider === "youtube" ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;

export const embedLabel = (provider: EmbedProvider) => (provider === "youtube" ? "YouTube video" : "Vimeo video");

/* ------------------------------------------------------- Cloudinary URLs */

const CLOUDINARY_DELIVERY = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\/)(.+)$/;
/** A path segment that is a transformation (`w_800,c_limit`) rather than a version (`v1712345678`) or a folder. */
const HAS_TRANSFORMATION = /^[a-z]{1,3}_[^/]+(,[a-z]{1,3}_[^/]+)*$/i;

export const isCloudinaryUrl = (url: string) => CLOUDINARY_DELIVERY.test(url);

/**
 * A resized, auto-format variant of an uploaded image, using Cloudinary's delivery URL. Anything that
 * isn't a plain Cloudinary upload URL (or already carries a transformation) comes back unchanged.
 * Variants are only built at render time; the stored URL is always the original.
 */
export function cloudinaryImageVariant(url: string, width: number): string {
    const match = CLOUDINARY_DELIVERY.exec(url);
    if (!match || match[2] !== "image") return url;
    const [, prefix, , rest] = match;
    if (HAS_TRANSFORMATION.test(rest.split("/")[0])) return url;
    return `${prefix}f_auto,q_auto,c_limit,w_${Math.round(width)}/${rest}`;
}

export function cloudinarySrcSet(url: string, widths: readonly number[] = [480, 768, 1200, 1600]): string | undefined {
    if (!isCloudinaryUrl(url)) return undefined;
    const variants = widths.map((w) => `${cloudinaryImageVariant(url, w)} ${w}w`);
    return variants.every((entry) => entry.startsWith(url)) ? undefined : variants.join(", ");
}

/** A still frame of a Cloudinary video (its first frame, as a JPEG), used as the `poster`. */
export function cloudinaryVideoPoster(url: string): string | null {
    const match = CLOUDINARY_DELIVERY.exec(url);
    if (!match || match[2] !== "video") return null;
    const [, prefix, , rest] = match;
    return `${prefix}so_0,f_jpg,q_auto,c_limit,w_1280/${rest.replace(/\.[A-Za-z0-9]+$/, ".jpg")}`;
}

/**
 * What a person types in the "Add link" box, turned into an address: "example.com" becomes
 * https://example.com, "me@example.com" becomes a mailto: link, and in-site paths and anchors are
 * kept. Returns `null` when the result isn't a safe link (so `javascript:` is refused here too).
 */
export function normalizeLinkInput(input: string): string | null {
    const value = input.trim();
    if (!value || /\s/.test(value)) return null;
    if (value.startsWith("/") || value.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(value)) return safeHref(value);
    if (value.includes("@") && !value.includes("/")) return safeHref(`mailto:${value}`);
    return safeHref(`https://${value}`);
}
