"use client";

import { useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from "react";
import { VideoOffIcon } from "lucide-react";
import { cn } from "cn";
import { useAttachedVideo } from "../hooks/useCallVideo";

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

// Clear of the name bar above and the controls below, and of a phone's notch and home bar.
const CORNERS: Record<Corner, string> = {
    "top-left": "left-[max(0.75rem,env(safe-area-inset-left))] top-[calc(env(safe-area-inset-top,0px)_+_4.75rem)] md:left-5",
    "top-right": "right-[max(0.75rem,env(safe-area-inset-right))] top-[calc(env(safe-area-inset-top,0px)_+_4.75rem)] md:right-5",
    "bottom-left": "bottom-[calc(env(safe-area-inset-bottom,0px)_+_9.5rem)] left-[max(0.75rem,env(safe-area-inset-left))] md:left-5",
    "bottom-right": "bottom-[calc(env(safe-area-inset-bottom,0px)_+_9.5rem)] right-[max(0.75rem,env(safe-area-inset-right))] md:right-5",
};

/** The tile follows the shape of the camera's picture, within these limits (9:16 to 16:9). */
const MIN_ASPECT = 9 / 16;
const MAX_ASPECT = 16 / 9;
const DEFAULT_ASPECT = 3 / 4;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

interface SelfViewProps {
    stream: MediaStream | null;
    /** Front cameras are shown mirrored, like a mirror. */
    mirror: boolean;
    cameraOff: boolean;
    /** The element the picture may be dragged around in. */
    boundsRef: RefObject<HTMLElement | null>;
}

/**
 * Your own camera, small, in a corner. Drag it anywhere; it settles in the nearest corner. The tile takes the
 * shape of the picture (upright for a phone, wide for a webcam), so none of it is cropped away.
 */
export function SelfView({ stream, mirror, cameraOff, boundsRef }: SelfViewProps) {
    const { ref, size } = useAttachedVideo(cameraOff ? null : stream);
    const aspect = size.width && size.height ? clamp(size.width / size.height, MIN_ASPECT, MAX_ASPECT) : DEFAULT_ASPECT;
    const upright = aspect < 1;
    const tile = useRef<HTMLDivElement>(null);
    const grab = useRef<{ dx: number; dy: number } | null>(null);
    const [corner, setCorner] = useState<Corner>("top-right");
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

    const measure = () => {
        const bounds = boundsRef.current?.getBoundingClientRect();
        const rect = tile.current?.getBoundingClientRect();
        return bounds && rect ? { bounds, rect } : null;
    };

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        const sizes = measure();
        if (!sizes) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        grab.current = { dx: event.clientX - sizes.rect.left, dy: event.clientY - sizes.rect.top };
        setPosition({ x: sizes.rect.left - sizes.bounds.left, y: sizes.rect.top - sizes.bounds.top });
    };

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const sizes = measure();
        if (!grab.current || !sizes) return;
        setPosition({
            x: clamp(event.clientX - grab.current.dx - sizes.bounds.left, 0, sizes.bounds.width - sizes.rect.width),
            y: clamp(event.clientY - grab.current.dy - sizes.bounds.top, 0, sizes.bounds.height - sizes.rect.height),
        });
    };

    const onPointerUp = () => {
        const sizes = measure();
        if (!grab.current) return;
        grab.current = null;
        setPosition(null);
        if (!sizes) return;

        const centerX = sizes.rect.left + sizes.rect.width / 2 - sizes.bounds.left;
        const centerY = sizes.rect.top + sizes.rect.height / 2 - sizes.bounds.top;
        setCorner(`${centerY < sizes.bounds.height / 2 ? "top" : "bottom"}-${centerX < sizes.bounds.width / 2 ? "left" : "right"}`);
    };

    return (
        <div
            ref={tile}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={
                {
                    aspectRatio: aspect,
                    ...(position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : null),
                } satisfies CSSProperties
            }
            className={cn(
                "absolute z-20 touch-none cursor-grab overflow-hidden rounded-2xl bg-zinc-800 shadow-xl ring-1 ring-white/25 transition-[width] duration-300 animate-in fade-in zoom-in-95 motion-reduce:transition-none motion-reduce:animate-none active:cursor-grabbing",
                upright ? "w-24 sm:w-28 md:w-32" : "w-32 sm:w-36 md:w-44",
                CORNERS[corner]
            )}
        >
            <video
                ref={ref}
                muted
                playsInline
                autoPlay
                aria-label="Your camera"
                className={cn("size-full object-cover", mirror && "-scale-x-100", cameraOff && "invisible")}
            />
            {cameraOff && (
                <div className="absolute inset-0 grid place-items-center gap-1 text-white/70">
                    <VideoOffIcon className="size-6" aria-hidden />
                    <span className="sr-only">Your camera is off</span>
                </div>
            )}
        </div>
    );
}
