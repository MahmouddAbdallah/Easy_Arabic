"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { AlertCircleIcon, LoaderCircleIcon, SendHorizontalIcon, SquareIcon, Trash2Icon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { MAX_VOICE_SECONDS, formatDuration } from "../../lib/attachments";
import type { VoiceMessageController } from "../../hooks/useVoiceMessage";
import { LiveWaveform } from "./LiveWaveform";
import { VoicePlayer } from "./VoicePlayer";

/** In the last stretch the timer says how long is left. */
const WARN_SECONDS = 30;

const ICON_BUTTON = "size-11 shrink-0 rounded-xl md:size-8";

/** What a screen reader hears when the step changes. (The ticking timer itself is not announced.) */
function getAnnouncement(voice: VoiceMessageController): string {
    switch (voice.phase) {
        case "requesting":
            return "Waiting for microphone permission.";
        case "recording":
            return "Recording voice message.";
        case "recorded":
            return `Recording finished, ${formatDuration(voice.recording?.duration) || "ready"}. You can listen to it, send it or delete it.`;
        case "sending":
            return voice.stage === "delivering" ? "Sending voice message." : "Uploading voice message.";
        default:
            return "";
    }
}

/**
 * The composer while a voice message is being made, in place of the text field:
 *   asking for the microphone -> recording (live waveform, timer) -> preview (play it back) -> sending (progress).
 * Cancel is always one tap away; send works straight from the recording or from the preview.
 */
export function VoiceComposer({ voice }: { voice: VoiceMessageController }) {
    const { phase, elapsed, recording, stage, progress, sendError } = voice;
    const groupRef = useRef<HTMLDivElement>(null);

    // The text field (and the mic button) this replaces had the focus: keep it in the voice controls, so
    // keyboard and screen-reader users aren't dropped at the top of the page, and Escape keeps working.
    useEffect(() => {
        if (phase === "recording" || phase === "recorded") groupRef.current?.focus({ preventScroll: true });
    }, [phase]);

    const canCancel = phase !== "sending" || stage === "uploading";
    const remaining = MAX_VOICE_SECONDS - elapsed;
    const nearLimit = phase === "recording" && remaining <= WARN_SECONDS;

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape" && canCancel) {
            event.preventDefault();
            voice.cancel();
        }
    };

    const cancelButton = (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={voice.cancel}
            disabled={!canCancel}
            aria-label={phase === "recorded" || phase === "sending" ? "Delete voice message" : "Cancel recording"}
            title={phase === "recorded" || phase === "sending" ? "Delete" : "Cancel"}
            className={cn(ICON_BUTTON, "text-muted-foreground hover:bg-destructive/10 hover:text-destructive")}
        >
            <Trash2Icon className="size-4" />
        </Button>
    );

    const sendButton = (
        <Button
            type="button"
            size="icon"
            onClick={voice.send}
            aria-label={sendError ? "Try sending again" : "Send voice message"}
            title={sendError ? "Try again" : "Send"}
            className={cn(
                ICON_BUTTON,
                "bg-primary text-primary-foreground shadow-sm shadow-primary/30 transition-all hover:bg-primary/90"
            )}
        >
            <SendHorizontalIcon className="size-4" />
        </Button>
    );

    return (
        <div className="flex flex-col gap-1.5">
            <div
                ref={groupRef}
                role="group"
                aria-label="Voice message"
                tabIndex={-1}
                onKeyDown={onKeyDown}
                className="flex min-h-14 items-center gap-1 rounded-2xl border border-border/40 bg-muted/30 p-1.5 shadow-sm outline-none md:min-h-12 md:gap-2"
            >
                <p role="status" className="sr-only">
                    {getAnnouncement(voice)}
                </p>

                {cancelButton}

                {phase === "requesting" && (
                    <p className="flex min-w-0 flex-1 items-center gap-2 px-1 text-xs text-muted-foreground">
                        <LoaderCircleIcon className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
                        <span className="truncate">Allow microphone access to record…</span>
                    </p>
                )}

                {phase === "recording" && (
                    <>
                        <div className="flex shrink-0 items-center gap-2 px-1">
                            <span
                                aria-hidden
                                className="size-2.5 rounded-full bg-destructive motion-safe:animate-pulse"
                            />
                            <span
                                role="timer"
                                aria-live="off"
                                aria-label="Recording time"
                                className={cn(
                                    "min-w-10 text-xs font-medium tabular-nums",
                                    nearLimit && "text-destructive"
                                )}
                            >
                                {nearLimit ? `${formatDuration(Math.max(remaining, 0))} left` : formatDuration(elapsed) || "0:00"}
                            </span>
                        </div>

                        <div className="h-8 min-w-0 flex-1 text-primary">
                            <LiveWaveform levelsRef={voice.levelsRef} />
                        </div>

                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={voice.finish}
                            aria-label="Stop recording and review"
                            title="Stop and review"
                            className={cn(ICON_BUTTON, "text-destructive hover:bg-destructive/10 hover:text-destructive")}
                        >
                            <SquareIcon className="size-4 fill-current" />
                        </Button>
                        {sendButton}
                    </>
                )}

                {phase === "recorded" && recording && (
                    <>
                        <VoicePlayer
                            key={recording.id}
                            src={recording.previewUrl}
                            type={recording.mimeType}
                            duration={recording.duration}
                            waveform={recording.waveform}
                            tone="composer"
                            preload="auto"
                            className="min-w-0 flex-1 px-1"
                        />
                        {sendButton}
                    </>
                )}

                {phase === "sending" && (
                    <>
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-1" aria-busy="true">
                            <span className="truncate text-xs text-muted-foreground">
                                {stage === "uploading" && progress < 99
                                    ? `Uploading voice message… ${progress}%`
                                    : "Sending voice message…"}
                            </span>
                            <span
                                role="progressbar"
                                aria-label="Uploading voice message"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={stage === "uploading" ? progress : 100}
                                className="h-1 overflow-hidden rounded-full bg-border"
                            >
                                <span
                                    className="block h-full rounded-full bg-primary transition-[width] duration-200"
                                    style={{ width: `${stage === "uploading" ? progress : 100}%` }}
                                />
                            </span>
                        </div>
                        <Button
                            type="button"
                            size="icon"
                            disabled
                            aria-label="Sending"
                            className={cn(ICON_BUTTON, "bg-primary/80")}
                        >
                            <LoaderCircleIcon className="size-4 animate-spin text-primary-foreground motion-reduce:animate-none" />
                        </Button>
                    </>
                )}
            </div>

            {sendError && phase === "recorded" && (
                <p role="alert" className="flex items-center gap-1.5 px-2 text-[11px] text-destructive">
                    <AlertCircleIcon className="size-3.5 shrink-0" />
                    <span>{sendError} Press send to try again.</span>
                </p>
            )}
        </div>
    );
}
