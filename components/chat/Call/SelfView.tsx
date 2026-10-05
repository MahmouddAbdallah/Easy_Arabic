"use client";

import { useRef, useState, type PointerEvent, type RefObject } from "react";
import { VideoOffIcon } from "lucide-react";
import { cn } from "cn";
import { useAttachedStream } from "../hooks/useCallMedia";

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

// Clear of the name bar above and the controls below.
const CORNERS: Record<Corner, string> = {
    "top-left": "left-3 top-20 md:left-5",
    "top-right": "right-3 top-20 md:right-5",
    "bottom-left": "bottom-40 left-3 md:left-5",
    "bottom-right": "bottom-40 right-3 md:right-5",
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

interface SelfViewProps {
    stream: MediaStream | null;
    /** Front cameras are shown mirrored, like a mirror. */
    mirror: boolean;
    cameraOff: boolean;
    /** The element the picture may be dragged around in. */
    boundsRef: RefObject<HTMLElement | null>;
}

/** Your own camera, small, in a corner. Drag it anywhere; it settles in the nearest corner. */
export function SelfView({ stream, mirror, cameraOff, boundsRef }: SelfViewProps) {
    const { ref } = useAttachedStream<HTMLVideoElement>(cameraOff ? null : stream);
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
            style={position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : undefined}
            className={cn(
                "absolute z-20 aspect-[3/4] w-24 touch-none cursor-grab overflow-hidden rounded-2xl bg-zinc-800 shadow-xl ring-1 ring-white/25 active:cursor-grabbing sm:w-28 md:aspect-video md:w-44",
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
