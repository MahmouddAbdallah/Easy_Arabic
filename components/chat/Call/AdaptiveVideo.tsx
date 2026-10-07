"use client";

import { useRef, type RefObject } from "react";
import { cn } from "cn";
import { useAttachedStream } from "../hooks/useCallMedia";
import { useElementSize, type VideoSize } from "../hooks/useCallVideo";

/**
 * The most of a picture that may be cut off to make it fill its frame. Beyond that the whole picture is shown
 * instead, with soft bars around it: a phone's upright picture in a wide window, or a wide picture on a tall
 * phone screen, is never zoomed into a slice of itself.
 */
const MAX_CROP = 0.12;

export type PictureFit = "cover" | "contain";

/** How a picture of size `video` should fill a frame of size `frame`. */
export function pictureFit(video: VideoSize, frame: VideoSize): PictureFit {
    if (!video.width || !video.height || !frame.width || !frame.height) return "contain";
    const videoAspect = video.width / video.height;
    const frameAspect = frame.width / frame.height;
    // The share of the picture that filling the frame would cut off.
    const cropped = 1 - Math.min(videoAspect / frameAspect, frameAspect / videoAspect);
    return cropped <= MAX_CROP ? "cover" : "contain";
}

/**
 * A soft, blurred copy of the picture, for the bars around it. The copy is small and scaled up, so the blur
 * is computed on a few thousand pixels instead of a whole screen.
 */
function Ambient({ stream }: { stream: MediaStream }) {
    const { ref } = useAttachedStream<HTMLVideoElement>(stream);
    return (
        <div aria-hidden className="absolute inset-0 overflow-hidden bg-zinc-950">
            <video
                ref={ref}
                muted
                playsInline
                autoPlay
                tabIndex={-1}
                className="absolute top-1/2 left-1/2 size-[12.5%] -translate-x-1/2 -translate-y-1/2 scale-[8] object-cover opacity-60 blur-sm saturate-150"
            />
            <div className="absolute inset-0 bg-black/30" />
        </div>
    );
}

interface AdaptiveVideoProps {
    /** The <video> that plays the stream. For a remote stream it is also what plays the sound. */
    videoRef: RefObject<HTMLVideoElement | null>;
    /** The same stream, for the soft copy that fills the bars. */
    stream: MediaStream | null;
    /** The size of the picture, from `useVideoSize`. */
    size: VideoSize;
    /** Fades the picture in and out. */
    visible: boolean;
    /** Front cameras are shown mirrored, like a mirror. */
    mirror?: boolean;
    /** Your own camera: silent, and not something to announce. */
    muted?: boolean;
    onPlaying?: () => void;
    onEmptied?: () => void;
    className?: string;
}

/** A video that fills its parent as fully as it can without cropping away more than a sliver of the picture. */
export function AdaptiveVideo({ videoRef, stream, size, visible, mirror = false, muted = false, onPlaying, onEmptied, className }: AdaptiveVideoProps) {
    const frameRef = useRef<HTMLDivElement>(null);
    const frame = useElementSize(frameRef);
    const fit = pictureFit(size, frame);

    return (
        <div ref={frameRef} className={cn("absolute inset-0 overflow-hidden", className)}>
            {visible && fit === "contain" && stream && <Ambient stream={stream} />}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={muted}
                aria-hidden={muted || undefined}
                onPlaying={onPlaying}
                onEmptied={onEmptied}
                className={cn(
                    "relative size-full transition-opacity duration-300 motion-reduce:transition-none",
                    fit === "cover" ? "object-cover" : "object-contain",
                    mirror && "-scale-x-100",
                    visible ? "opacity-100" : "opacity-0"
                )}
            />
        </div>
    );
}
