"use client";

import { useRef } from "react";
import { CopyIcon } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "cn";
import { useCallQuality } from "../hooks/useCall";
import { PANEL_TOGGLE_ATTRIBUTE, usePanelDismiss } from "../hooks/usePanelDismiss";
import { QUALITY_LABEL, type CallRoute, type ConnectionQuality, type QualityLevel, type VideoPicture } from "../lib/callQuality";

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

/** How the sound arrives: the share of it the listener heard as made-up filler. */
function formatSound(concealed: number | null): string {
    if (concealed === null) return "—";
    if (concealed < 0.02) return "Clear";
    if (concealed < 0.08) return "Some glitches";
    return "Choppy";
}

const NETWORK_LABEL: Record<string, string> = { wifi: "Wi‑Fi", cellular: "Mobile data", ethernet: "Ethernet", vpn: "VPN", bluetooth: "Bluetooth" };

function formatNetwork(route: CallRoute | null): string | null {
    if (!route?.network) return null;
    return NETWORK_LABEL[route.network] ?? route.network.charAt(0).toUpperCase() + route.network.slice(1);
}

/** "Direct · UDP", "Via relay · TLS". */
function formatRoute(route: CallRoute | null): string {
    if (!route || route.kind === "unknown") return "—";
    const way = route.kind === "relay" ? "Via relay" : "Direct";
    return route.protocol === "unknown" ? way : `${way} · ${route.protocol.toUpperCase()}`;
}

function formatCodecs(quality: ConnectionQuality): string {
    const names = [quality.sample.videoCodec, quality.sample.audioCodec].filter((name): name is string => name !== null);
    return names.length > 0 ? names.join(" · ") : "—";
}

/** What the connection is doing about a weak link, and what would help, in words. At most two, most important first. */
function tips(quality: ConnectionQuality): string[] {
    const { sample, sending } = quality;
    const found: string[] = [];
    if (sending?.paused) found.push("Video is paused so your voice stays clear. It comes back when the connection allows.");
    else if (sending?.reduced) found.push("Video quality is lowered to keep the call smooth. It returns to full quality when the connection improves.");
    if ((sample.loss ?? 0) >= 0.05) found.push("Packets are getting lost on the way. Moving closer to your router, or using a cable, usually helps.");
    if ((sample.rttMs ?? 0) >= 400) found.push("The connection is slow to respond, so there will be a delay in the conversation.");
    if (sample.limit === "bandwidth" && !sending?.reduced) found.push("Your upload speed is limiting video quality.");
    if (sample.limit === "cpu") found.push("Your device is working hard, so video quality is lowered.");
    return found.slice(0, 2);
}

/** The details as plain text, for pasting into a message to whoever is helping. */
function diagnosticsText(quality: ConnectionQuality, level: QualityLevel, relayAvailable: boolean): string {
    const { sample } = quality;
    const lines: Array<[string, string]> = [
        ["Connection", `${QUALITY_LABEL[level]} (${quality.score}/100)`],
        ["Latency", formatMs(sample.rttMs)],
        ["Packet loss", formatLoss(sample.loss)],
        ["Jitter", formatMs(sample.jitterMs)],
        ["Upload", formatRate(sample.sendKbps)],
        ["Download", formatRate(sample.receiveKbps)],
        ["Video sent", formatPicture(sample.sent)],
        ["Video received", formatPicture(sample.received)],
        ["Sound", formatSound(sample.audioConcealed)],
        ["Codecs", formatCodecs(quality)],
        ["Route", formatRoute(sample.route)],
        ["Network", formatNetwork(sample.route) ?? "—"],
        ["Relay server", relayAvailable ? "Available" : "Not set up"],
    ];
    return lines.map(([label, value]) => `${label}: ${value}`).join("\n");
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
            {...{ [PANEL_TOGGLE_ATTRIBUTE]: "" }}
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
    /** The call was given a TURN relay to fall back on. */
    relayAvailable: boolean;
    onClose: () => void;
}

/**
 * The numbers behind the signal bars: latency, loss, bitrate, picture size, codecs and route. It sits against the
 * right edge of the call screen, below the header, whatever buttons the header holds, so a narrow phone never clips it.
 */
export function ConnectionDetails({ level, relayAvailable, onClose }: ConnectionDetailsProps) {
    const quality = useCallQuality();
    const root = useRef<HTMLDivElement>(null);
    usePanelDismiss(root, onClose);

    const notes = quality && level !== "lost" ? tips(quality) : [];
    const network = quality ? formatNetwork(quality.sample.route) : null;

    const copy = async () => {
        if (!quality) return;
        try {
            await navigator.clipboard.writeText(diagnosticsText(quality, level, relayAvailable));
            toast.success("Connection details copied.", { id: "call-diagnostics-copied" });
        } catch {
            toast.error("Couldn't copy the details.", { id: "call-diagnostics-copied" });
        }
    };

    return (
        <div
            ref={root}
            id={DETAILS_ID}
            role="group"
            aria-label="Connection details"
            className="absolute top-[calc(env(safe-area-inset-top,0px)_+_4.25rem)] right-4 z-40 w-[min(18rem,calc(100%_-_2rem))] origin-top-right rounded-2xl bg-zinc-900/95 p-4 text-sm text-white shadow-2xl ring-1 ring-white/15 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none"
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
                    <Row label="Sound" value={formatSound(quality.sample.audioConcealed)} />
                    <Row label="Upload" value={formatRate(quality.sample.sendKbps)} />
                    <Row label="Download" value={formatRate(quality.sample.receiveKbps)} />
                    {(quality.sample.sent || quality.sample.received) && (
                        <>
                            <Row label="Video sent" value={formatPicture(quality.sample.sent)} />
                            <Row label="Video received" value={formatPicture(quality.sample.received)} />
                        </>
                    )}
                    <Row label="Codecs" value={formatCodecs(quality)} />
                    {quality.sample.route && <Row label="Route" value={formatRoute(quality.sample.route)} />}
                    {network && <Row label="Network" value={network} />}
                    <Row label="Relay server" value={relayAvailable ? "Available" : "Not set up"} />
                </dl>
            ) : (
                <p className="text-white/60">Measuring…</p>
            )}

            {notes.map((note) => (
                <p key={note} className="mt-3 text-xs leading-relaxed text-white/60">
                    {note}
                </p>
            ))}

            {quality && (
                <button
                    type="button"
                    onClick={() => void copy()}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium outline-none transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/80"
                >
                    <CopyIcon className="size-3.5" aria-hidden /> Copy details
                </button>
            )}
        </div>
    );
}
