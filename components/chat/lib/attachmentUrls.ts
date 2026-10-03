import type { MessageAttachment } from "../types";

/**
 * Delivery URLs for attachments stored in Cloudinary. Pure string helpers (no SDK, no secrets).
 *
 * The URL saved with a message is the plain delivery URL of the original file. These helpers
 * insert Cloudinary transformations right after `/upload/` so the browser downloads a right-sized,
 * optimized copy (`f_auto/q_auto`) instead of the original: far less data on a phone.
 *
 *   https://res.cloudinary.com/<cloud>/<image|video|raw>/upload/<transformations>/v123/<public_id>.<ext>
 *
 * Anything that isn't a Cloudinary delivery URL is returned untouched.
 */

const DELIVERY_URL = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\/)(.+)$/;

interface DeliveryParts {
    /** Everything up to and including `/upload/`. */
    base: string;
    resourceType: "image" | "video" | "raw";
    /** What follows `/upload/`: `v123/<public_id>.<ext>`. */
    path: string;
}

function parseDeliveryUrl(url: string | undefined): DeliveryParts | null {
    const match = url ? DELIVERY_URL.exec(url) : null;
    return match ? { base: match[1], resourceType: match[2] as DeliveryParts["resourceType"], path: match[3] } : null;
}

/**
 * `<base><t1>/<t2>/v123/<public_id>[.<extension>]`. The original extension is always dropped: with
 * `f_auto` the format is negotiated, otherwise `extension` states the one wanted.
 */
function build(parts: DeliveryParts, transformations: string[], extension?: string): string {
    const id = parts.path.replace(/\.[A-Za-z0-9]{1,8}$/, "");
    const steps = transformations.length > 0 ? `${transformations.join("/")}/` : "";
    return `${parts.base}${steps}${id}${extension ? `.${extension}` : ""}`;
}

export const isCloudinaryUrl = (url: string | undefined): boolean => parseDeliveryUrl(url) !== null;

/** Animated GIFs keep their original file so the animation survives. */
const isGif = (attachment: MessageAttachment) =>
    attachment.mimeType === "image/gif" || /\.gif$/i.test(attachment.fileName ?? "");

/** Widths (px) of the `srcset` candidates for message thumbnails. */
const IMAGE_WIDTHS = [320, 640, 960] as const;

/** The image no wider than `width` px, in the best format the browser supports. Falls back to the stored URL. */
export function getImageUrl(attachment: MessageAttachment, width: number): string | undefined {
    const parts = parseDeliveryUrl(attachment.url);
    if (!parts || parts.resourceType !== "image" || isGif(attachment)) return attachment.url;
    return build(parts, [`c_limit,w_${width}`, "f_auto", "q_auto"]);
}

/** `srcset` for message thumbnails, or undefined when the image can't be resized. */
export function getImageSrcSet(attachment: MessageAttachment): string | undefined {
    const parts = parseDeliveryUrl(attachment.url);
    if (!parts || parts.resourceType !== "image" || isGif(attachment)) return undefined;
    return IMAGE_WIDTHS.map((width) => `${getImageUrl(attachment, width)} ${width}w`).join(", ");
}

/** The large version shown in the viewer. */
export const getLightboxImageUrl = (attachment: MessageAttachment): string | undefined =>
    getImageUrl(attachment, 1600);

/** A JPEG of the first frame of a video: its poster/thumbnail. */
export function getVideoPosterUrl(attachment: MessageAttachment, width = 720): string | undefined {
    const parts = parseDeliveryUrl(attachment.url);
    if (!parts || parts.resourceType !== "video") return undefined;
    return build(parts, [`c_limit,so_0,w_${width}`, "q_auto"], "jpg");
}

export interface VideoSource {
    src: string;
    type?: string;
}

/** Plays as uploaded in every current browser. Other containers (.mov, .mkv, .3gp) get a streamable copy first. */
const PLAYABLE_AS_UPLOADED = new Set(["video/mp4", "video/webm"]);

/** `<source>` candidates for a video, best first. The original file is always the last resort. */
export function getVideoSources(attachment: MessageAttachment): VideoSource[] {
    const original = attachment.url;
    if (!original) return [];

    const parts = parseDeliveryUrl(original);
    if (!parts || parts.resourceType !== "video") return [{ src: original }];

    if (attachment.mimeType && PLAYABLE_AS_UPLOADED.has(attachment.mimeType)) {
        return [{ src: original, type: attachment.mimeType }];
    }
    // No `type` on the fallback: a browser skips sources whose declared type it doesn't know,
    // and this one is the last chance to play anything at all.
    return [{ src: build(parts, ["vc_auto", "f_auto:video", "q_auto"]) }, { src: original }];
}

export interface AudioSource {
    src: string;
    type?: string;
}

/**
 * Where a voice message plays from, best first: the recording as it was uploaded, then an MP3 copy
 * that Cloudinary makes the first time it is asked for. The copy is the fallback for a browser that
 * can't decode what the sender's browser recorded (WebM/Opus on an older Safari, say); it also has
 * an exact length, which a raw browser recording does not.
 */
export function getAudioSources(attachment: MessageAttachment): AudioSource[] {
    const original = attachment.url;
    if (!original) return [];

    const source: AudioSource = attachment.mimeType ? { src: original, type: attachment.mimeType } : { src: original };
    const parts = parseDeliveryUrl(original);
    // Audio is stored under Cloudinary's `video` kind; anything else has no MP3 to offer.
    if (!parts || parts.resourceType !== "video") return [source];

    return [source, { src: build(parts, [], "mp3"), type: "audio/mpeg" }];
}
