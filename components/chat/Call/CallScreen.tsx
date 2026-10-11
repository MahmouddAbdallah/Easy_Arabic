"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import {
    LoaderCircleIcon,
    MaximizeIcon,
    MicIcon,
    MicOffIcon,
    MinimizeIcon,
    PhoneOffIcon,
    PictureInPicture2Icon,
    ScreenShareIcon,
    ScreenShareOffIcon,
    SlidersHorizontalIcon,
    SwitchCameraIcon,
    TriangleAlertIcon,
    VideoIcon,
    VideoOffIcon,
    Volume2Icon,
    WifiOffIcon,
    XIcon,
} from "lucide-react";
import { cn } from "cn";
import type { CallActions } from "../hooks/useCall";
import { useAudioLevel, useElapsedSeconds } from "../hooks/useCallMedia";
import {
    useAttachedVideo,
    useFullscreen,
    useIdleControls,
    usePictureInPicture,
    type VideoSize,
} from "../hooks/useCallVideo";
import { useAudioOutput } from "../hooks/useMediaDevices";
import { PANEL_TOGGLE_ATTRIBUTE } from "../hooks/usePanelDismiss";
import { formatDuration } from "../lib/attachments";
import type { CallEndedKind, CallSessionState } from "../lib/callController";
import { canShareScreen } from "../lib/callMedia";
import { AdaptiveVideo } from "./AdaptiveVideo";
import { CallAvatar } from "./CallAvatar";
import { ConnectionDetails, ConnectionIndicator } from "./ConnectionIndicator";
import { ControlButton } from "./ControlButton";
import { DEVICE_MENU_ID, DeviceMenu } from "./DeviceMenu";
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

/** What to tell the person about the connection, if anything. `busy` is for something that is being worked on. */
function connectionNotice(call: CallSessionState, isVideo: boolean, name: string): { text: string; busy: boolean } | null {
    if (call.phase === "reconnecting") {
        // A voice call already says so in big letters.
        return isVideo ? { text: call.offline ? "Waiting for network…" : "Reconnecting…", busy: true } : null;
    }
    if (call.phase !== "active") return null;
    const sendingPicture = !call.cameraOff || call.sharingScreen;
    if (isVideo && call.videoPaused && sendingPicture) {
        return { text: call.sharingScreen ? "Weak connection — your screen share is paused" : "Weak connection — your video is paused", busy: false };
    }
    if (isVideo && call.remoteVideoPaused && !call.remoteCameraOff) return { text: `Weak connection — ${name}'s video is paused`, busy: false };
    if (call.quality === "poor") return { text: "Weak connection", busy: false };
    return null;
}

const LANDSCAPE_ASPECT = 16 / 9;
const MIN_UPRIGHT_ASPECT = 9 / 16;

/** The window follows the other person's picture: wide for a landscape one, tall for a phone held upright. */
function windowAspect(picture: VideoSize): number {
    if (!picture.width || !picture.height) return LANDSCAPE_ASPECT;
    const aspect = picture.width / picture.height;
    return aspect < 1 ? Math.max(aspect, MIN_UPRIGHT_ASPECT) : LANDSCAPE_ASPECT;
}

// On a phone or a small tablet the call fills the screen. From laptop size up it is a window, shaped like the
// picture it shows (--call-aspect), as large as fits.
const VIDEO_WINDOW =
    "lg:h-auto lg:max-h-[min(88dvh,820px)] lg:min-w-88 lg:w-[min(92vw,1100px,calc(min(88dvh,820px)*var(--call-aspect)))] lg:aspect-(--call-aspect) lg:rounded-3xl lg:shadow-2xl lg:ring-1 lg:ring-white/10 lg:transition-[width] lg:duration-300";
const VOICE_WINDOW = "md:h-[min(86dvh,780px)] md:max-w-md md:rounded-3xl md:shadow-2xl md:ring-1 md:ring-white/10";

/** A short label with an icon, for things like "Muted" next to a name. */
function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warning" }) {
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

function HeaderButton({
    label,
    onClick,
    pressed,
    panel,
    children,
}: {
    label: string;
    onClick: () => void;
    pressed?: boolean;
    /** The button opens a floating panel: whether it is open, and its id. */
    panel?: { open: boolean; id: string };
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            {...(panel ? { [PANEL_TOGGLE_ATTRIBUTE]: "", "aria-expanded": panel.open, "aria-controls": panel.open ? panel.id : undefined } : null)}
            aria-label={label}
            aria-pressed={pressed}
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
    const { ref, size } = useAttachedVideo(stream);
    return (
        <>
            <AdaptiveVideo videoRef={ref} stream={stream} size={size} visible muted mirror={mirror} className="z-0" />
            <div aria-hidden className="absolute inset-0 z-0 bg-black/35" />
        </>
    );
}

interface CallScreenProps {
    call: CallSessionState;
    actions: Pick<
        CallActions,
        "toggleMute" | "toggleCamera" | "switchCamera" | "toggleScreenShare" | "selectMicrophone" | "selectCamera" | "endCall" | "dismissEnded"
    >;
}

/** The call itself: voice or video, from "Calling…" to the final "Call ended". */
export function CallScreen({ call, actions }: CallScreenProps) {
    const { phase, mode, peer } = call;
    const isVideo = mode === "video";
    const ended = phase === "ended";
    const reconnecting = phase === "reconnecting";
    const name = peer?.name ?? "Call";

    const panelRef = useRef<HTMLDivElement>(null);
    const lastPointer = useRef("mouse");
    const clock = formatDuration(useElapsedSeconds(call.connectedAt));
    const level = useAudioLevel(ended ? null : call.remoteStream);
    const { ref: remoteRef, blocked: soundBlocked, resume: resumeSound, size: remoteSize } = useAttachedVideo(call.remoteStream);
    const [videoLive, setVideoLive] = useState(false);
    const [controlsHovered, setControlsHovered] = useState(false);
    const [panel, setPanel] = useState<"connection" | "devices" | null>(null);
    const fullscreen = useFullscreen(panelRef);
    const output = useAudioOutput(remoteRef);
    const canShare = useMemo(() => isVideo && canShareScreen(), [isVideo]);
    const togglePanel = (next: "connection" | "devices") => setPanel((open) => (open === next ? null : next));
    const closePanel = useCallback(() => setPanel(null), []);

    // Their picture only replaces the avatar once frames are actually playing, and not while their camera is off
    // (or their connection is too weak to carry it).
    const hasRemoteVideo =
        isVideo && !ended && !call.remoteCameraOff && !call.remoteVideoPaused && (call.remoteStream?.getVideoTracks().length ?? 0) > 0;
    const showRemoteVideo = hasRemoteVideo && videoLive;
    const previewing = isVideo && !call.cameraOff && !!call.localStream && (phase === "starting" || phase === "outgoing");
    const overVideo = showRemoteVideo || previewing;
    const status = statusText(call, clock);
    const notice = connectionNotice(call, isVideo, name);

    const pip = usePictureInPicture(remoteRef, isVideo && phase === "active");
    // Over a picture the controls step aside after a few seconds; any touch, move or key brings them back.
    const indicatorLevel = reconnecting ? "lost" : phase === "active" ? call.quality : null;
    const detailsShown = panel === "connection" && indicatorLevel !== null;
    const devicesShown = panel === "devices" && !ended;
    const idle = useIdleControls(isVideo && phase === "active" && showRemoteVideo && !detailsShown && !devicesShown && !controlsHovered && !soundBlocked);
    const panelStyle = isVideo ? ({ "--call-aspect": windowAspect(remoteSize).toFixed(4) } as CSSProperties) : undefined;

    useEffect(() => {
        panelRef.current?.focus({ preventScroll: true });
    }, []);

    // A tap on the picture shows or hides the controls; a double click (mouse) goes full screen.
    const onSurfaceClick = () => {
        if (lastPointer.current === "mouse") idle.wake();
        else idle.toggle();
    };
    const onSurfaceDoubleClick = () => {
        if (lastPointer.current === "mouse" && fullscreen.supported) void fullscreen.toggle();
    };
    const hoverControls = (hovered: boolean) => (event: { pointerType: string }) => {
        if (event.pointerType === "mouse") setControlsHovered(hovered);
    };
    // M mutes, V turns the camera on and off, S shares the screen: the same keys as the buttons' tooltips say.
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        idle.wake();
        if (ended || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
        if ((event.target as HTMLElement).closest("input, select, textarea, [contenteditable='true']")) return;
        switch (event.key.toLowerCase()) {
            case "m":
                if (phase !== "starting") actions.toggleMute();
                break;
            case "v":
                if (isVideo && phase !== "starting") actions.toggleCamera();
                break;
            case "s":
                if (canShare && phase === "active") actions.toggleScreenShare();
                break;
            default:
                return;
        }
        event.preventDefault();
    };

    return (
        <div
            className={cn(
                "fixed inset-0 z-100 flex items-center justify-center bg-black/70",
                isVideo ? "lg:p-6 lg:backdrop-blur-sm" : "md:p-6 md:backdrop-blur-sm"
            )}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={`${isVideo ? "Video" : "Voice"} call with ${name}`}
                tabIndex={-1}
                style={panelStyle}
                onPointerMove={idle.wake}
                onPointerDown={idle.wake}
                onKeyDown={onKeyDown}
                onFocus={idle.wake}
                className={cn(
                    "relative isolate flex h-dvh w-full flex-col overflow-hidden bg-zinc-950 text-white outline-none",
                    isVideo ? VIDEO_WINDOW : VOICE_WINDOW,
                    fullscreen.active && "md:rounded-none md:ring-0 lg:rounded-none lg:ring-0"
                )}
            >
                <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-zinc-800 via-zinc-900 to-zinc-950" />
                <div
                    aria-hidden
                    className="absolute inset-0 -z-10 bg-[radial-gradient(60%_45%_at_50%_32%,rgba(16,185,129,0.16),transparent)]"
                />

                {/* The other person. Always present: it is also what plays their voice. */}
                {isVideo ? (
                    <AdaptiveVideo
                        videoRef={remoteRef}
                        stream={call.remoteStream}
                        size={remoteSize}
                        visible={showRemoteVideo}
                        alwaysContain={call.remoteSharing}
                        onPlaying={() => setVideoLive(true)}
                        onEmptied={() => setVideoLive(false)}
                        // While the link is down the last picture stays, dimmed and soft, instead of looking alive.
                        className={cn("z-0 transition-[filter] duration-500 motion-reduce:transition-none", reconnecting && "blur-sm brightness-75")}
                    />
                ) : (
                    <video ref={remoteRef} autoPlay playsInline className="pointer-events-none absolute size-px opacity-0" />
                )}
                {previewing && <FullPreview stream={call.localStream} mirror={call.mirrorLocal} />}

                {showRemoteVideo && (
                    <div
                        aria-hidden
                        onPointerUp={(event) => {
                            lastPointer.current = event.pointerType;
                        }}
                        onClick={onSurfaceClick}
                        onDoubleClick={onSurfaceDoubleClick}
                        className="absolute inset-0 z-5 touch-manipulation"
                    />
                )}

                {pip.active && showRemoteVideo && (
                    <div aria-hidden className="pointer-events-none absolute inset-0 z-6 grid place-items-center">
                        <Pill>
                            <PictureInPicture2Icon aria-hidden /> Playing in picture-in-picture
                        </Pill>
                    </div>
                )}

                <header
                    onPointerEnter={hoverControls(true)}
                    onPointerLeave={hoverControls(false)}
                    className={cn(
                        "relative z-10 flex items-start justify-between gap-3 pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-6 pl-[max(1rem,env(safe-area-inset-left))] transition-[opacity,translate] duration-300 motion-reduce:transition-none [@media(max-height:480px)]:pb-3",
                        overVideo && "bg-linear-to-b from-black/60 to-transparent",
                        !idle.visible && "pointer-events-none -translate-y-3 opacity-0"
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
                                {call.remoteSharing && (
                                    <p className="mt-1.5">
                                        <Pill>
                                            <ScreenShareIcon aria-hidden /> Sharing their screen
                                        </Pill>
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {call.offline && (
                            <Pill tone="warning">
                                <WifiOffIcon aria-hidden /> You&apos;re offline
                            </Pill>
                        )}
                        {(phase === "active" || reconnecting) && (
                            <ConnectionIndicator level={indicatorLevel} open={detailsShown} onToggle={() => togglePanel("connection")} />
                        )}
                        {!ended && call.localStream && (
                            <HeaderButton
                                label="Audio and video settings"
                                panel={{ open: devicesShown, id: DEVICE_MENU_ID }}
                                onClick={() => togglePanel("devices")}
                            >
                                <SlidersHorizontalIcon aria-hidden />
                            </HeaderButton>
                        )}
                        {pip.supported && isVideo && showRemoteVideo && !ended && (
                            <HeaderButton
                                label={pip.active ? "Exit picture-in-picture" : "Picture-in-picture"}
                                pressed={pip.active}
                                onClick={() => void pip.toggle()}
                            >
                                <PictureInPicture2Icon aria-hidden />
                            </HeaderButton>
                        )}
                        {fullscreen.supported && !ended && (
                            // A voice call only offers it on larger screens; a video call everywhere it works.
                            <span className={cn(!isVideo && "hidden md:block")}>
                                <HeaderButton label={fullscreen.active ? "Exit full screen" : "Full screen"} onClick={() => void fullscreen.toggle()}>
                                    {fullscreen.active ? <MinimizeIcon aria-hidden /> : <MaximizeIcon aria-hidden />}
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
                    <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center animate-in fade-in duration-300 motion-reduce:animate-none">
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

                {isVideo && !ended && !previewing && !call.sharingScreen && phase !== "starting" && (
                    <SelfView stream={call.localStream} mirror={call.mirrorLocal} cameraOff={call.cameraOff} boundsRef={panelRef} />
                )}

                <div className="pointer-events-none absolute top-[calc(env(safe-area-inset-top,0px)_+_4rem)] left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2">
                    <div role="status">
                        {notice && !ended && (
                            <div
                                key={notice.text}
                                className="animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none"
                                aria-hidden={notice.busy || undefined}
                            >
                                <Pill tone="warning">
                                    {notice.busy ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <TriangleAlertIcon aria-hidden />}
                                    {notice.text}
                                </Pill>
                            </div>
                        )}
                    </div>
                    {/* Always on screen while sharing, even when the other controls have faded away: nobody should forget it. */}
                    {call.sharingScreen && !ended && (
                        <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-emerald-500/90 py-1.5 pr-1.5 pl-4 text-sm font-medium text-white shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none">
                            <ScreenShareIcon className="size-4 shrink-0" aria-hidden />
                            <span>You&apos;re sharing your screen</span>
                            <button
                                type="button"
                                onClick={actions.toggleScreenShare}
                                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-900 outline-none transition-colors hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-600"
                            >
                                Stop sharing
                            </button>
                        </div>
                    )}
                </div>

                {detailsShown && <ConnectionDetails level={indicatorLevel} relayAvailable={call.relayAvailable} onClose={closePanel} />}
                {devicesShown && <DeviceMenu call={call} actions={actions} output={output} onClose={closePanel} />}

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
                        onPointerEnter={hoverControls(true)}
                        onPointerLeave={hoverControls(false)}
                        className={cn(
                            "relative z-10 flex items-end justify-center gap-4 px-4 pt-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] transition-[opacity,translate] duration-300 motion-reduce:transition-none sm:gap-6 [@media(max-height:480px)]:pt-2 [@media(max-height:480px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]",
                            overVideo && "bg-linear-to-t from-black/70 to-transparent",
                            !idle.visible && "pointer-events-none translate-y-3 opacity-0"
                        )}
                    >
                        <ControlButton
                            label={call.muted ? "Unmute" : "Mute"}
                            shortcut="M"
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
                                shortcut="V"
                                pressed={call.cameraOff}
                                variant={call.cameraOff ? "on" : "glass"}
                                disabled={phase === "starting"}
                                onClick={actions.toggleCamera}
                            >
                                {call.cameraOff ? <VideoOffIcon /> : <VideoIcon />}
                            </ControlButton>
                        )}

                        {canShare && (
                            <ControlButton
                                label={call.sharingScreen ? "Stop sharing" : "Share screen"}
                                shortcut="S"
                                pressed={call.sharingScreen}
                                variant={call.sharingScreen ? "on" : "glass"}
                                disabled={phase !== "active"}
                                onClick={actions.toggleScreenShare}
                            >
                                {call.sharingScreen ? <ScreenShareOffIcon /> : <ScreenShareIcon />}
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
