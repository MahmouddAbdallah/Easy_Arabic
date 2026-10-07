"use client";

import { useEffect, useRef } from "react";
import { cn } from "cn";
import { useCallQuality } from "../hooks/useCall";
import { QUALITY_LABEL, type ConnectionQuality, type QualityLevel, type VideoPicture } from "../lib/callQuality";

const LIT_BARS: Record<QualityLevel, number> = { excellent: 4, good: 3, fair: 2, poor: 1, lost: 0 };
const TONE: Record<QualityLevel, string> = {
    excellent: "text-emerald-400",
    good: "text-emerald-400",
    fair: "text-amber-300",
    poor: "text-red-400",
    lost: "text-red-400",
};
const BAR_HEIGHTS = [4, 7, 10, 13] as const;

/** Four rising bars, like a phone's signal icon. */
function SignalBars({ level, className }: { level: QualityLevel; className?: string }) {
    return (
        <svg viewBox="0 0 16 14" aria-hidden className={cn("h-3.5 w-4 shrink-0", TONE[level], className)}>
            {BAR_HEIGHTS.map((height, index) => (
                <rect
                    key={height}
                    x={index * 4}
                    y={14 - height}
                    width="3"
                    height={height}
                    rx="1"
                    fill="currentColor"
                    opacity={index < LIT_BARS[level] ? 1 : 0.25}
                />
            ))}
        </svg>
    );
}

const formatRate = (kbps: number) => (kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${Math.round(kbps)} kbps`);
const formatPicture = (picture: VideoPicture | null) => (picture ? `${picture.width}×${picture.height} · ${picture.fps} fps` : "—");
const formatLoss = (loss: number | null) => (loss === null ? "—" : `${(loss * 100).toFixed(loss < 0.1 ? 1 : 0)}%`);
const formatMs = (ms: number | null) => (ms === null ? "—" : `${Math.round(ms)} ms`);

/** What the connection is doing about a weak link, in words. */
function explanation(quality: ConnectionQuality): string | null {
    if (quality.sending?.paused) return "Video is paused so your voice stays clear. It comes back when the connection allows.";
    if (quality.sending?.reduced) return "Video quality is lowered to keep the call smooth. It returns to full quality when the connection improves.";
    if (quality.sample.limit === "cpu") return "Your device is working hard, so video quality is lowered.";
    return null;
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <dt className="text-white/55">{label}</dt>
            <dd className="text-right">{value}</dd>
        </div>
    );
}

/** The id of the details panel, for the button that opens it. There is only ever one call screen. */
const DETAILS_ID = "call-connection-details";
const TOGGLE_ATTRIBUTE = "data-connection-toggle";

interface ConnectionIndicatorProps {
    /** The level to show; null before the first measurement, when nothing is shown. */
    level: QualityLevel | null;
    open: boolean;
    onToggle: () => void;
}

/** Signal bars for the call: the button. Its details open in <ConnectionDetails>, which the call screen places. */
export function ConnectionIndicator({ level, open, onToggle }: ConnectionIndicatorProps) {
    if (!level) return null;
    return (
        <button
            type="button"
            {...{ [TOGGLE_ATTRIBUTE]: "" }}
            aria-label={`Connection quality: ${QUALITY_LABEL[level]}`}
            aria-expanded={open}
            aria-controls={open ? DETAILS_ID : undefined}
            title={`Connection: ${QUALITY_LABEL[level]}`}
            onClick={onToggle}
            className="grid size-10 place-items-center rounded-full bg-white/10 outline-none backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/80"
        >
            <SignalBars level={level} />
        </button>
    );
}

interface ConnectionDetailsProps {
    level: QualityLevel;
    onClose: () => void;
}

/**
 * The numbers behind the signal bars: latency, loss, bitrate, picture size. It sits against the right edge of
 * the call screen, below the header, whatever buttons the header holds, so a narrow phone never clips it.
 */
export function ConnectionDetails({ level, onClose }: ConnectionDetailsProps) {
    const quality = useCallQuality();
    const root = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Element | null;
            // A press on the bars themselves is the button's to handle (it closes the panel).
            if (!target || root.current?.contains(target) || target.closest(`[${TOGGLE_ATTRIBUTE}]`)) return;
            onClose();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            onClose();
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [onClose]);

    const note = quality && level !== "lost" ? explanation(quality) : null;

    return (
        <div
            ref={root}
            id={DETAILS_ID}
            role="group"
            aria-label="Connection details"
            className="absolute top-[calc(env(safe-area-inset-top,0px)_+_4.25rem)] right-4 z-40 w-[min(16rem,calc(100%_-_2rem))] origin-top-right rounded-2xl bg-zinc-900/95 p-4 text-sm text-white shadow-2xl ring-1 ring-white/15 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none"
        >
            <div className="mb-3 flex items-center justify-between gap-3">
                <span className="font-semibold">Connection</span>
                <span className={cn("flex items-center gap-1.5 font-medium", TONE[level])}>
                    <SignalBars level={level} />
                    {QUALITY_LABEL[level]}
                </span>
            </div>

            {quality ? (
                <dl className="space-y-1.5 text-white/90 tabular-nums">
                    <Row label="Latency" value={formatMs(quality.sample.rttMs)} />
                    <Row label="Packet loss" value={formatLoss(quality.sample.loss)} />
                    <Row label="Jitter" value={formatMs(quality.sample.jitterMs)} />
                    <Row label="Upload" value={formatRate(quality.sample.sendKbps)} />
                    <Row label="Download" value={formatRate(quality.sample.receiveKbps)} />
                    {(quality.sample.sent || quality.sample.received) && (
                        <>
                            <Row label="Video sent" value={formatPicture(quality.sample.sent)} />
                            <Row label="Video received" value={formatPicture(quality.sample.received)} />
                        </>
                    )}
                    {quality.sample.relayed !== null && <Row label="Route" value={quality.sample.relayed ? "Via relay" : "Direct"} />}
                </dl>
            ) : (
                <p className="text-white/60">Measuring…</p>
            )}

            {note && <p className="mt-3 text-xs leading-relaxed text-white/60">{note}</p>}
        </div>
    );
}
