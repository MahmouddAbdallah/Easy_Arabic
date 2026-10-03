"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    DownloadIcon,
    ImageOffIcon,
    LoaderCircleIcon,
    VideoOffIcon,
    XIcon,
} from "lucide-react";
import { cn } from "cn";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAttachmentDownload } from "../../hooks/useAttachmentDownload";
import { formatFileSize } from "../../lib/attachments";
import { getLightboxImageUrl, getVideoPosterUrl, getVideoSources } from "../../lib/attachmentUrls";
import type { MessageAttachment } from "../../types";

/** Swipe distance (px) that counts as "next/previous". */
const SWIPE_DISTANCE = 60;

function ViewerMedia({ attachment }: { attachment: MessageAttachment }) {
    const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
    // See MediaTile: the image may already be done before onLoad is attached.
    const imageRef = useCallback((image: HTMLImageElement | null) => {
        if (image?.complete) setState(image.naturalWidth > 0 ? "ready" : "failed");
    }, []);
    const isVideo = attachment.type === "video";
    const image = getLightboxImageUrl(attachment);
    const sources = getVideoSources(attachment);

    if (state === "failed" || (isVideo ? sources.length === 0 : !image)) {
        const Icon = isVideo ? VideoOffIcon : ImageOffIcon;
        return (
            <div className="flex flex-col items-center gap-2 text-white/70">
                <Icon className="size-10" />
                <span className="text-sm">{isVideo ? "This video can't be played." : "This photo can't be shown."}</span>
            </div>
        );
    }

    return (
        <>
            {state === "loading" && <LoaderCircleIcon className="absolute size-8 animate-spin text-white/60" />}
            {isVideo ? (
                <video
                    controls
                    autoPlay
                    playsInline
                    poster={getVideoPosterUrl(attachment, 1280)}
                    onLoadedMetadata={() => setState("ready")}
                    className="max-h-full max-w-full bg-black object-contain"
                >
                    {sources.map((source, index) => (
                        <source
                            key={source.src}
                            src={source.src}
                            type={source.type}
                            onError={index === sources.length - 1 ? () => setState("failed") : undefined}
                        />
                    ))}
                </video>
            ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    ref={imageRef}
                    src={image}
                    alt={attachment.fileName ?? "Photo"}
                    draggable={false}
                    onLoad={() => setState("ready")}
                    onError={() => setState("failed")}
                    className={cn(
                        "max-h-full max-w-full object-contain transition-opacity duration-200",
                        state === "ready" ? "opacity-100" : "opacity-0"
                    )}
                />
            )}
        </>
    );
}

interface MediaViewerProps {
    media: MessageAttachment[];
    /** The item being viewed, or null when the viewer is closed. */
    index: number | null;
    onIndexChange: (index: number) => void;
    onClose: () => void;
}

/** Full-screen viewer for the photos and videos of a message: swipe/arrow keys to browse, download, Esc to close. */
export function MediaViewer({ media, index, onIndexChange, onClose }: MediaViewerProps) {
    const current = index === null ? undefined : media[index];
    const { download, isDownloading } = useAttachmentDownload();
    const swipeStart = useRef<number | null>(null);

    const step = useCallback(
        (delta: number) => {
            if (index === null) return;
            const next = index + delta;
            if (next >= 0 && next < media.length) onIndexChange(next);
        },
        [index, media.length, onIndexChange]
    );

    useEffect(() => {
        if (index === null) return;
        const onKeyDown = (event: KeyboardEvent) => {
            // Arrow keys belong to the video's own seek bar while it has focus.
            if (event.target instanceof HTMLVideoElement) return;
            if (event.key === "ArrowLeft") step(-1);
            else if (event.key === "ArrowRight") step(1);
        };
        // Capture phase: the dialog's own key handling stops these events before they bubble up to window.
        window.addEventListener("keydown", onKeyDown, true);
        return () => window.removeEventListener("keydown", onKeyDown, true);
    }, [index, step]);

    const title = current?.fileName ?? (current?.type === "video" ? "Video" : "Photo");
    const size = formatFileSize(current?.fileSize);

    return (
        <Dialog open={index !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showCloseButton={false}
                className="top-0 left-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 rounded-none bg-black p-0 text-white ring-0 sm:max-w-none"
            >
                <DialogTitle className="sr-only">{title}</DialogTitle>

                <div className="flex items-center gap-1 px-2 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))]">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="grid size-11 shrink-0 place-items-center rounded-full outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                        <XIcon className="size-5" />
                    </button>
                    <div className="min-w-0 flex-1 px-1">
                        <p dir="auto" className="truncate text-sm font-medium" title={title}>
                            {title}
                        </p>
                        <p className="truncate text-xs text-white/60">
                            {index !== null && media.length > 1 ? `${index + 1} of ${media.length}` : ""}
                            {index !== null && media.length > 1 && size ? " · " : ""}
                            {size}
                        </p>
                    </div>
                    {current?.url && (
                        <button
                            type="button"
                            onClick={() => download(current)}
                            disabled={isDownloading}
                            aria-label={`Download ${title}`}
                            title="Download"
                            className="grid size-11 shrink-0 place-items-center rounded-full outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-60"
                        >
                            {isDownloading ? <LoaderCircleIcon className="size-5 animate-spin" /> : <DownloadIcon className="size-5" />}
                        </button>
                    )}
                </div>

                <div
                    className="relative flex min-h-0 items-center justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
                    onTouchStart={(event) => {
                        swipeStart.current = event.touches.length === 1 ? event.touches[0].clientX : null;
                    }}
                    onTouchEnd={(event) => {
                        if (swipeStart.current === null) return;
                        const distance = event.changedTouches[0].clientX - swipeStart.current;
                        swipeStart.current = null;
                        if (Math.abs(distance) >= SWIPE_DISTANCE) step(distance < 0 ? 1 : -1);
                    }}
                >
                    {current && <ViewerMedia key={current.publicId ?? current.url ?? index} attachment={current} />}

                    {index !== null && index > 0 && (
                        <button
                            type="button"
                            onClick={() => step(-1)}
                            aria-label="Previous"
                            className="absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 outline-none backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/60"
                        >
                            <ChevronLeftIcon className="size-6" />
                        </button>
                    )}
                    {index !== null && index < media.length - 1 && (
                        <button
                            type="button"
                            onClick={() => step(1)}
                            aria-label="Next"
                            className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 outline-none backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/60"
                        >
                            <ChevronRightIcon className="size-6" />
                        </button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
