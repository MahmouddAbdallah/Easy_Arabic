"use client";

import { useCallback, useState, type CSSProperties } from "react";
import { FilmIcon, ImageOffIcon, PlayIcon, VideoOffIcon } from "lucide-react";
import { cn } from "cn";
import { formatDuration } from "../../lib/attachments";
import { getImageSrcSet, getImageUrl, getVideoPosterUrl, getVideoSources } from "../../lib/attachmentUrls";
import type { MessageAttachment } from "../../types";

/** Most tiles shown in a message; the last one says how many more there are. */
const MAX_TILES = 4;

/** width/height of the media, kept within sensible bounds so one photo never takes over the chat. */
function aspectRatio(attachment: MessageAttachment, min: number, max: number, fallback: number): number {
    if (!attachment.width || !attachment.height) return fallback;
    return Math.min(max, Math.max(min, attachment.width / attachment.height));
}

const tileLabel = (attachment: MessageAttachment) =>
    attachment.fileName ?? (attachment.type === "video" ? "Video" : "Photo");

interface MediaTileProps {
    attachment: MessageAttachment;
    onOpen: () => void;
    className?: string;
    style?: CSSProperties;
    /** "+3": drawn over the tile when more media is hidden behind it. */
    more?: string;
}

/** One photo or video thumbnail. Reserves its space up front, so the chat doesn't jump while it loads. */
function MediaTile({ attachment, onOpen, className, style, more }: MediaTileProps) {
    const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
    // An image can finish (or fail) before React attaches onLoad/onError, e.g. when it comes from the
    // cache: check once when the element appears so the tile never stays blank.
    const imageRef = useCallback((image: HTMLImageElement | null) => {
        if (image?.complete) setStatus(image.naturalWidth > 0 ? "loaded" : "failed");
    }, []);
    const isVideo = attachment.type === "video";
    const src = isVideo ? getVideoPosterUrl(attachment) : getImageUrl(attachment, 640);
    const showImage = Boolean(src) && status !== "failed";
    const duration = formatDuration(attachment.duration);

    return (
        <button
            type="button"
            onClick={onOpen}
            disabled={!attachment.url}
            aria-label={`Open ${tileLabel(attachment)}`}
            className={cn(
                "relative block w-full overflow-hidden bg-black/10 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                isVideo && "bg-neutral-900",
                className
            )}
            style={style}
        >
            {showImage && (
                // A plain <img>: Cloudinary already serves a resized, optimized copy (see attachmentUrls),
                // and next/image would need Cloudinary's host added to next.config.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    ref={imageRef}
                    src={src}
                    srcSet={isVideo ? undefined : getImageSrcSet(attachment)}
                    sizes="(max-width: 640px) 80vw, 320px"
                    alt={tileLabel(attachment)}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    onLoad={() => setStatus("loaded")}
                    onError={() => setStatus("failed")}
                    className={cn(
                        "size-full object-cover transition-opacity duration-300",
                        status === "loaded" ? "opacity-100" : "opacity-0"
                    )}
                />
            )}

            {status === "loading" && showImage && <span className="absolute inset-0 animate-pulse bg-foreground/10" />}

            {!showImage && !isVideo && (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                    <ImageOffIcon className="size-6" />
                    <span className="text-[10px]">Photo unavailable</span>
                </span>
            )}

            {isVideo && (
                <>
                    {!showImage && <FilmIcon className="absolute inset-0 m-auto size-8 text-white/40" />}
                    <span className="absolute inset-0 grid place-items-center">
                        <span className="grid size-11 place-items-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm">
                            <PlayIcon className="ml-0.5 size-5 fill-current" />
                        </span>
                    </span>
                    {duration && (
                        <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                            <FilmIcon className="size-3" />
                            {duration}
                        </span>
                    )}
                </>
            )}

            {more && (
                <span className="absolute inset-0 grid place-items-center bg-black/55 text-xl font-semibold text-white">
                    {more}
                </span>
            )}
        </button>
    );
}

/** A single video, played right in the message with the browser's own controls. */
function InlineVideo({ attachment }: { attachment: MessageAttachment }) {
    const [failed, setFailed] = useState(false);
    const sources = getVideoSources(attachment);

    if (sources.length === 0 || failed) {
        return (
            <div className="flex aspect-video flex-col items-center justify-center gap-1.5 rounded-xl bg-black/10 text-muted-foreground">
                <VideoOffIcon className="size-6" />
                <span className="text-[10px]">Video unavailable</span>
            </div>
        );
    }

    return (
        <div
            className="overflow-hidden rounded-xl bg-black"
            style={{ aspectRatio: aspectRatio(attachment, 0.6, 1.8, 16 / 9), maxHeight: "min(70vh, 28rem)" }}
        >
            <video
                controls
                playsInline
                preload="metadata"
                poster={getVideoPosterUrl(attachment)}
                aria-label={tileLabel(attachment)}
                className="size-full object-contain"
            >
                {sources.map((source, index) => (
                    <source
                        key={source.src}
                        src={source.src}
                        type={source.type}
                        // <video> reports nothing when its sources fail: the last source's error is the verdict.
                        onError={index === sources.length - 1 ? () => setFailed(true) : undefined}
                    />
                ))}
            </video>
        </div>
    );
}

interface MediaGridProps {
    media: MessageAttachment[];
    /** Index (in `media`) of the tile that was tapped. */
    onOpen: (index: number) => void;
}

/**
 * The photos and videos of a message. One photo is shown large, one video plays inline; several
 * form a 2-column grid (like WhatsApp), with "+N" on the last tile when there are more than four.
 */
export function MediaGrid({ media, onOpen }: MediaGridProps) {
    if (media.length === 1) {
        const only = media[0];
        if (only.type === "video") return <InlineVideo attachment={only} />;
        return (
            <MediaTile
                attachment={only}
                onOpen={() => onOpen(0)}
                className="rounded-xl"
                style={{ aspectRatio: aspectRatio(only, 0.75, 1.6, 4 / 3) }}
            />
        );
    }

    const shown = media.slice(0, MAX_TILES);
    const hidden = media.length - shown.length;
    const hasWideFirst = shown.length === 3;

    return (
        <div className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-xl">
            {shown.map((attachment, index) => (
                <MediaTile
                    key={attachment.publicId ?? attachment.url ?? index}
                    attachment={attachment}
                    onOpen={() => onOpen(index)}
                    className={cn(hasWideFirst && index === 0 && "col-span-2")}
                    style={{ aspectRatio: hasWideFirst && index === 0 ? 2 : 1 }}
                    more={hidden > 0 && index === shown.length - 1 ? `+${hidden + 1}` : undefined}
                />
            ))}
        </div>
    );
}
