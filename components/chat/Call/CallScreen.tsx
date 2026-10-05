"use client";

import { useEffect, useRef, useState } from "react";
import {
    MaximizeIcon,
    MicIcon,
    MicOffIcon,
    MinimizeIcon,
    PhoneOffIcon,
    SwitchCameraIcon,
    VideoIcon,
    VideoOffIcon,
    Volume2Icon,
    WifiOffIcon,
    XIcon,
} from "lucide-react";
import { cn } from "cn";
import type { CallActions } from "../hooks/useCall";
import { useAttachedStream, useAudioLevel, useElapsedSeconds } from "../hooks/useCallMedia";
import { formatDuration } from "../lib/attachments";
import type { CallEndedKind, CallSessionState } from "../lib/callController";
import { CallAvatar } from "./CallAvatar";
import { ControlButton } from "./ControlButton";
import { SelfView } from "./SelfView";

const ENDED_TEXT: Record<CallEndedKind, string> = {
    ended: "Call ended",
    failed: "Call failed",
    declined: "Call declined",
    missed: "No answer",
    cancelled: "Call cancelled",
    busy: "User is busy",
};

function statusText(call: CallSessionState, clock: string): string {
    switch (call.phase) {
        case "starting":
            return "Starting…";
        case "outgoing":
            return call.serverStatus === "ringing" ? "Ringing…" : "Calling…";
        case "answering":
        case "connecting":
            return "Connecting…";
        case "reconnecting":
            return call.offline ? "Waiting for network…" : "Reconnecting…";
        case "active":
            return clock;
        case "ended": {
            const text = ENDED_TEXT[call.endedKind ?? "ended"];
            return call.endedKind === "ended" && call.duration > 0 ? `${text} · ${formatDuration(call.duration)}` : text;
        }
        default:
            return "";
    }
}

/** A short label with an icon, for things like "Muted" next to a name. */
function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warning" }) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-md [&_svg]:size-3.5",
                tone === "warning" ? "bg-amber-400/20 text-amber-100" : "bg-white/15 text-white"
            )}
        >
            {children}
        </span>
    );
}

function HeaderButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
            className="grid size-10 place-items-center rounded-full bg-white/10 text-white outline-none backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/80 [&_svg]:size-5"
        >
            {children}
        </button>
    );
}

/** Your own camera, full screen, while the call is still being placed (like the phone's own camera app). */
function FullPreview({ stream, mirror }: { stream: MediaStream | null; mirror: boolean }) {
    const { ref } = useAttachedStream<HTMLVideoElement>(stream);
    return (
        <>
            <video
                ref={ref}
                muted
                playsInline
                autoPlay
                aria-hidden
                className={cn("absolute inset-0 z-0 size-full object-cover", mirror && "-scale-x-100")}
            />
            <div aria-hidden className="absolute inset-0 z-0 bg-black/35" />
        </>
    );
}

interface CallScreenProps {
    call: CallSessionState;
    actions: Pick<CallActions, "toggleMute" | "toggleCamera" | "switchCamera" | "endCall" | "dismissEnded">;
}

/** The call itself: voice or video, from "Calling…" to the final "Call ended". */
export function CallScreen({ call, actions }: CallScreenProps) {
    const { phase, mode, peer } = call;
    const isVideo = mode === "video";
    const ended = phase === "ended";
    const name = peer?.name ?? "Call";

    const panelRef = useRef<HTMLDivElement>(null);
    const clock = formatDuration(useElapsedSeconds(call.connectedAt));
    const level = useAudioLevel(ended ? null : call.remoteStream);
    const { ref: remoteRef, blocked: soundBlocked, resume: resumeSound } = useAttachedStream<HTMLVideoElement>(call.remoteStream);
    const [videoLive, setVideoLive] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);

    // Their picture only replaces the avatar once frames are actually playing, and not while their camera is off.
    const hasRemoteVideo = isVideo && !ended && !call.remoteCameraOff && (call.remoteStream?.getVideoTracks().length ?? 0) > 0;
    const showRemoteVideo = hasRemoteVideo && videoLive;
    const previewing = isVideo && !call.cameraOff && !!call.localStream && (phase === "starting" || phase === "outgoing");
    const overVideo = showRemoteVideo || previewing;
    const status = statusText(call, clock);
    const canFullscreen = typeof document !== "undefined" && document.fullscreenEnabled;

    useEffect(() => {
        panelRef.current?.focus({ preventScroll: true });
    }, []);

    useEffect(() => {
        const onChange = () => setFullscreen(document.fullscreenElement === panelRef.current);
        document.addEventListener("fullscreenchange", onChange);
        return () => document.removeEventListener("fullscreenchange", onChange);
    }, []);

    const toggleFullscreen = () => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void panelRef.current?.requestFullscreen().catch(() => undefined);
    };

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 md:p-6 md:backdrop-blur-sm">
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={`${isVideo ? "Video" : "Voice"} call with ${name}`}
                tabIndex={-1}
                className={cn(
                    "relative isolate flex h-dvh w-full flex-col overflow-hidden bg-zinc-950 text-white outline-none md:h-[min(86dvh,780px)] md:rounded-3xl md:shadow-2xl md:ring-1 md:ring-white/10",
                    isVideo ? "md:max-w-4xl" : "md:max-w-md"
                )}
            >
                <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-zinc-800 via-zinc-900 to-zinc-950" />
                <div
                    aria-hidden
                    className="absolute inset-0 -z-10 bg-[radial-gradient(60%_45%_at_50%_32%,rgba(16,185,129,0.16),transparent)]"
                />

                {/* The other person. Always present: it is also what plays their voice. */}
                <video
                    ref={remoteRef}
                    autoPlay
                    playsInline
                    onPlaying={() => setVideoLive(true)}
                    onEmptied={() => setVideoLive(false)}
                    className={
                        isVideo
                            ? cn(
                                "absolute inset-0 z-0 size-full object-cover transition-opacity duration-300",
                                showRemoteVideo ? "opacity-100" : "opacity-0"
                            )
                            : "pointer-events-none absolute size-px opacity-0"
                    }
                />
                {previewing && <FullPreview stream={call.localStream} mirror={call.mirrorLocal} />}

                <header
                    className={cn(
                        "relative z-10 flex items-start justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-6",
                        overVideo && "bg-linear-to-b from-black/60 to-transparent"
                    )}
                >
                    <div className="min-w-0 pt-1">
                        {showRemoteVideo && (
                            <>
                                <h2 className="flex items-center gap-2 text-base font-semibold drop-shadow">
                                    <span className="truncate">{name}</span>
                                    {call.remoteMuted && <MicOffIcon className="size-4 shrink-0 text-white/80" aria-label="Muted" />}
                                </h2>
                                <p aria-live="polite" className="text-sm text-white/80 tabular-nums drop-shadow">
                                    {status}
                                </p>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {call.offline && (
                            <Pill tone="warning">
                                <WifiOffIcon aria-hidden /> You&apos;re offline
                            </Pill>
                        )}
                        {canFullscreen && !ended && (
                            <span className="hidden md:block">
                                <HeaderButton label={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen}>
                                    {fullscreen ? <MinimizeIcon aria-hidden /> : <MaximizeIcon aria-hidden />}
                                </HeaderButton>
                            </span>
                        )}
                        {ended && (
                            <HeaderButton label="Close" onClick={actions.dismissEnded}>
                                <XIcon aria-hidden />
                            </HeaderButton>
                        )}
                    </div>
                </header>

                {showRemoteVideo ? (
                    <div className="flex-1" />
                ) : (
                    <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                        <CallAvatar name={name} size="xl" ringing={phase === "outgoing"} level={level} />
                        <div className="max-w-full space-y-1.5">
                            <h2 className="truncate text-2xl font-semibold drop-shadow">{name}</h2>
                            <p aria-live="polite" className="text-base text-white/75 tabular-nums drop-shadow">
                                {status}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {call.remoteMuted && !ended && (
                                <Pill>
                                    <MicOffIcon aria-hidden /> Muted
                                </Pill>
                            )}
                            {isVideo && call.remoteCameraOff && !ended && (
                                <Pill>
                                    <VideoOffIcon aria-hidden /> Camera off
                                </Pill>
                            )}
                        </div>
                    </div>
                )}

                {isVideo && !ended && !previewing && phase !== "starting" && (
                    <SelfView stream={call.localStream} mirror={call.mirrorLocal} cameraOff={call.cameraOff} boundsRef={panelRef} />
                )}

                {soundBlocked && (
                    <button
                        type="button"
                        onClick={resumeSound}
                        className="absolute top-24 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                        <Volume2Icon className="size-4" aria-hidden /> Tap to enable sound
                    </button>
                )}

                {!ended && (
                    <footer
                        className={cn(
                            "relative z-10 flex items-end justify-center gap-4 px-4 pt-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] sm:gap-6",
                            overVideo && "bg-linear-to-t from-black/70 to-transparent"
                        )}
                    >
                        <ControlButton
                            label={call.muted ? "Unmute" : "Mute"}
                            pressed={call.muted}
                            variant={call.muted ? "on" : "glass"}
                            disabled={phase === "starting"}
                            onClick={actions.toggleMute}
                        >
                            {call.muted ? <MicOffIcon /> : <MicIcon />}
                        </ControlButton>

                        {isVideo && (
                            <ControlButton
                                label={call.cameraOff ? "Start video" : "Stop video"}
                                pressed={call.cameraOff}
                                variant={call.cameraOff ? "on" : "glass"}
                                disabled={phase === "starting"}
                                onClick={actions.toggleCamera}
                            >
                                {call.cameraOff ? <VideoOffIcon /> : <VideoIcon />}
                            </ControlButton>
                        )}

                        {isVideo && call.canSwitchCamera && !call.cameraOff && (
                            <ControlButton label="Flip camera" onClick={actions.switchCamera}>
                                <SwitchCameraIcon />
                            </ControlButton>
                        )}

                        <ControlButton label="End call" variant="danger" onClick={actions.endCall}>
                            <PhoneOffIcon />
                        </ControlButton>
                    </footer>
                )}
            </div>
        </div>
    );
}
