"use client";

import { useEffect, useRef, type RefObject } from "react";
import { cn } from "cn";
import { LIVE_WAVEFORM_BARS } from "../../hooks/useVoiceRecorder";

interface LiveWaveformProps {
    /** Recent loudness readings (0-1), newest last. Owned by the recorder and mutated in place. */
    levelsRef: RefObject<number[]>;
    className?: string;
}

/**
 * The waveform shown while recording: the newest sound enters on the right and the rest scrolls left.
 * It paints straight onto the bars from an animation frame, so 60 updates a second never reach React.
 */
export function LiveWaveform({ levelsRef, className }: LiveWaveformProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const bars = Array.from(container.children) as HTMLElement[];

        let frame = 0;
        const paint = () => {
            const levels = levelsRef.current;
            const offset = levels.length - bars.length;
            for (let i = 0; i < bars.length; i++) {
                // Before the first readings arrive there is nothing to draw: the bar rests at its minimum.
                const level = levels[offset + i] ?? 0;
                bars[i].style.transform = `scaleY(${Math.max(0.12, level)})`;
            }
            frame = requestAnimationFrame(paint);
        };
        frame = requestAnimationFrame(paint);
        return () => cancelAnimationFrame(frame);
    }, [levelsRef]);

    return (
        <div ref={containerRef} aria-hidden className={cn("flex h-full w-full items-center gap-[3px]", className)}>
            {Array.from({ length: LIVE_WAVEFORM_BARS }, (_, index) => (
                <span
                    key={index}
                    className="h-full min-w-[2px] flex-1 origin-center rounded-full bg-current will-change-transform"
                    style={{ transform: "scaleY(0.12)" }}
                />
            ))}
        </div>
    );
}
