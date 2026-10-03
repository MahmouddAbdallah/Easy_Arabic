"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
    type PointerEvent,
} from "react";
import { AlertCircleIcon, LoaderCircleIcon, PauseIcon, PlayIcon } from "lucide-react";
import { cn } from "cn";
import { formatDuration } from "../../lib/attachments";
import { WaveformBars, getPlaceholderWaveform } from "./Waveform";

export type VoicePlayerTone =
    /** In a bubble I sent (on the primary colour). */
    | "own"
    /** In a bubble I received. */
    | "other"
    /** In the composer, while previewing a recording. */
    | "composer";

const TONES: Record<VoicePlayerTone, { button: string; wave: string; text: string; ring: string }> = {
    own: {
        button: "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30",
        wave: "text-primary-foreground",
        text: "text-primary-foreground/80",
        ring: "focus-visible:ring-primary-foreground/70",
    },
    other: {
        button: "bg-primary text-primary-foreground hover:bg-primary/90",
        wave: "text-primary",
        text: "text-muted-foreground",
        ring: "focus-visible:ring-ring",
    },
    composer: {
        button: "bg-primary text-primary-foreground hover:bg-primary/90",
        wave: "text-primary",
        text: "text-muted-foreground",
        ring: "focus-visible:ring-ring",
    },
};

const RATES = [1, 1.5, 2] as const;
/** Arrow keys on the waveform jump this far. */
const KEY_SEEK_SECONDS = 5;

interface Source {
    src: string;
    type?: string;
}

/** Drops the sources this browser says it can't decode, so it never downloads a file it can't play. */
function pickPlayable(sources: Source[]): Source[] {
    if (typeof document === "undefined") return sources;
    const probe = document.createElement("audio");
    const playable = sources.filter((source) => !source.type || probe.canPlayType(source.type) !== "");
    return playable.length > 0 ? playable : sources;
}

/** The audio that is playing right now: starting another voice message pauses it (like every messenger). */
let activeAudio: HTMLAudioElement | null = null;

export interface VoicePlayerProps {
    src: string;
    /** MIME type of `src`, used to skip it when the browser can't play it. */
    type?: string;
    /** Tried when `src` can't be played. */
    fallbackSrc?: string;
    fallbackType?: string;
    /** Length in seconds. Browser recordings can't report their own length, so it is passed in. */
    duration?: number;
    /** 0-100 bars. Without them a stand-in waveform is drawn. */
    waveform?: readonly number[];
    /** Keeps the stand-in waveform the same for the same message. */
    seed?: string;
    tone: VoicePlayerTone;
    /** "none" for messages in the list (nothing downloads until play); "auto" for the local preview. */
    preload?: "none" | "metadata" | "auto";
    disabled?: boolean;
    className?: string;
}

/**
 * A voice message player: play/pause, a waveform you can tap or drag to seek (and use the arrow keys
 * on), the time, and 1x / 1.5x / 2x speed. Shows a spinner while buffering and a retry when the audio
 * can't be played. Give it a new `key` for a different message.
 */
export function VoicePlayer({
    src,
    type,
    fallbackSrc,
    fallbackType,
    duration,
    waveform,
    seed,
    tone,
    preload = "none",
    disabled = false,
    className,
}: VoicePlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const waveRef = useRef<HTMLDivElement>(null);
    /** The user asked for playback (so a fallback source should carry on playing). */
    const wantsPlayRef = useRef(false);
    /** Start playing as soon as the source that was just switched to is in place. */
    const resumeRef = useRef(false);
    const scrubbingRef = useRef(false);

    const [sourceIndex, setSourceIndex] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [waiting, setWaiting] = useState(false);
    const [failed, setFailed] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [rate, setRate] = useState<number>(1);
    const [mediaDuration, setMediaDuration] = useState(0);

    const sources = useMemo(
        () => pickPlayable([{ src, type }, ...(fallbackSrc ? [{ src: fallbackSrc, type: fallbackType }] : [])]),
        [src, type, fallbackSrc, fallbackType]
    );
    const source = sources[Math.min(sourceIndex, sources.length - 1)];

    // The length given to us wins: what the browser reports for a raw recording is often missing or Infinity.
    const total = duration && duration > 0 ? duration : mediaDuration;
    const totalRef = useRef(total);
    useEffect(() => {
        totalRef.current = total;
    });

    const bars = useMemo(
        () => (waveform && waveform.length > 0 ? waveform : getPlaceholderWaveform(seed ?? src)),
        [waveform, seed, src]
    );

    /** Moves the played part of the waveform to where the audio is. Straight onto the DOM: no re-render per frame. */
    const paint = useCallback(() => {
        const audio = audioRef.current;
        const wave = waveRef.current;
        if (!audio || !wave) return;
        const length = totalRef.current;
        wave.style.setProperty("--progress", length > 0 ? String(Math.min(1, audio.currentTime / length)) : "0");
    }, []);

    useEffect(() => {
        if (!playing) return;
        let frame = 0;
        const loop = () => {
            paint();
            frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frame);
    }, [playing, paint]);

    // After falling back to the next source, carry on playing if that is what the user wanted.
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !resumeRef.current) return;
        resumeRef.current = false;
        audio.play().catch(() => undefined); // a failure reaches onError and moves on again
    }, [sourceIndex]);

    // Leaving the screen stops the sound.
    useEffect(() => {
        const audio = audioRef.current;
        return () => {
            if (!audio) return;
            audio.pause();
            if (activeAudio === audio) activeAudio = null;
        };
    }, []);

    const startPlayback = useCallback((audio: HTMLAudioElement) => {
        wantsPlayRef.current = true;
        setWaiting(true);
        audio.play().catch((error: unknown) => {
            const name = (error as { name?: string } | null)?.name;
            // AbortError: paused or reloaded before it began. NotSupportedError: reported by onError, which
            // moves on to the next source.
            if (name === "AbortError" || name === "NotSupportedError") return;
            wantsPlayRef.current = false;
            setWaiting(false);
            setFailed(true);
        });
    }, []);

    const toggle = useCallback(() => {
        const audio = audioRef.current;
        if (!audio || disabled) return;

        if (!audio.paused && !audio.ended) {
            wantsPlayRef.current = false;
            audio.pause();
            return;
        }
        if (failed) {
            setFailed(false);
            if (sourceIndex !== 0) {
                // Back to the first source; the effect above starts it once it is in place.
                wantsPlayRef.current = true;
                resumeRef.current = true;
                setWaiting(true);
                setSourceIndex(0);
                return;
            }
            audio.load();
        }
        startPlayback(audio);
    }, [disabled, failed, sourceIndex, startPlayback]);

    const handleError = () => {
        setPlaying(false);
        setWaiting(false);
        if (sourceIndex < sources.length - 1) {
            resumeRef.current = wantsPlayRef.current;
            if (resumeRef.current) setWaiting(true);
            setSourceIndex(sourceIndex + 1);
            return;
        }
        wantsPlayRef.current = false;
        setFailed(true);
    };

    const seekTo = (seconds: number) => {
        const audio = audioRef.current;
        if (!audio || totalRef.current <= 0) return;
        try {
            audio.currentTime = Math.min(Math.max(0, seconds), totalRef.current);
        } catch {
            return; // not seekable (yet)
        }
        setCurrentTime(audio.currentTime);
        paint();
    };

    const seekFromPointer = (event: PointerEvent<HTMLDivElement>) => {
        const rect = waveRef.current?.getBoundingClientRect();
        if (!rect || rect.width === 0) return;
        seekTo(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * totalRef.current);
    };

    const onWavePointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (disabled || failed || event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        scrubbingRef.current = true;
        seekFromPointer(event);
    };
    const onWavePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (scrubbingRef.current) seekFromPointer(event);
    };
    const endScrub = () => {
        scrubbingRef.current = false;
    };

    const onWaveKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        if (!audio || disabled || failed) return;
        const now = audio.currentTime;
        switch (event.key) {
            case "ArrowRight":
            case "ArrowUp":
                seekTo(now + KEY_SEEK_SECONDS);
                break;
            case "ArrowLeft":
            case "ArrowDown":
                seekTo(now - KEY_SEEK_SECONDS);
                break;
            case "Home":
                seekTo(0);
                break;
            case "End":
                seekTo(totalRef.current);
                break;
            default:
                return;
        }
        event.preventDefault();
    };

    const cycleRate = () => {
        const next = RATES[(RATES.indexOf(rate as (typeof RATES)[number]) + 1) % RATES.length];
        setRate(next);
        const audio = audioRef.current;
        if (audio) {
            audio.defaultPlaybackRate = next; // survives a source change
            audio.playbackRate = next;
        }
    };

    const colors = TONES[tone];
    const shownTime = playing || currentTime > 0 ? currentTime : total;
    const lengthLabel = formatDuration(total);

    return (
        <div className={cn("flex items-center gap-2.5", disabled && "pointer-events-none opacity-70", className)}>
            <audio
                ref={audioRef}
                src={source?.src}
                preload={preload}
                onPlay={(event) => {
                    const audio = event.currentTarget;
                    if (activeAudio && activeAudio !== audio) activeAudio.pause();
                    activeAudio = audio;
                    setPlaying(true);
                }}
                onPlaying={() => setWaiting(false)}
                onCanPlay={() => setWaiting(false)}
                onWaiting={() => setWaiting(true)}
                onPause={() => {
                    setPlaying(false);
                    setWaiting(false);
                    paint();
                }}
                onEnded={(event) => {
                    wantsPlayRef.current = false;
                    setPlaying(false);
                    setCurrentTime(0);
                    event.currentTarget.currentTime = 0;
                    paint();
                }}
                onTimeUpdate={(event) => {
                    if (!scrubbingRef.current) setCurrentTime(event.currentTarget.currentTime);
                }}
                onLoadedMetadata={(event) => {
                    const length = event.currentTarget.duration;
                    if (Number.isFinite(length) && length > 0) setMediaDuration(length);
                }}
                onDurationChange={(event) => {
                    const length = event.currentTarget.duration;
                    if (Number.isFinite(length) && length > 0) setMediaDuration(length);
                }}
                onError={handleError}
            />

            <button
                type="button"
                onClick={toggle}
                disabled={disabled}
                aria-label={
                    failed
                        ? "Couldn't play this voice message. Try again"
                        : playing
                          ? "Pause voice message"
                          : lengthLabel
                            ? `Play voice message, ${lengthLabel}`
                            : "Play voice message"
                }
                className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-full outline-none transition-colors focus-visible:ring-2 disabled:opacity-60 md:size-9",
                    colors.button,
                    colors.ring
                )}
            >
                {waiting ? (
                    <LoaderCircleIcon className="size-5 animate-spin motion-reduce:animate-none md:size-4" />
                ) : failed ? (
                    <AlertCircleIcon className="size-5 md:size-4" />
                ) : playing ? (
                    <PauseIcon className="size-5 fill-current md:size-4" />
                ) : (
                    <PlayIcon className="size-5 translate-x-px fill-current md:size-4" />
                )}
            </button>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
                {/* The timeline always runs left to right, even in a right-to-left page. */}
                <div
                    ref={waveRef}
                    dir="ltr"
                    role="slider"
                    tabIndex={disabled || failed ? -1 : 0}
                    aria-label="Seek voice message"
                    aria-valuemin={0}
                    aria-valuemax={Math.max(1, Math.round(total))}
                    aria-valuenow={Math.min(Math.round(currentTime), Math.max(1, Math.round(total)))}
                    aria-valuetext={`${formatDuration(currentTime) || "0:00"} of ${lengthLabel || "unknown length"}`}
                    aria-disabled={disabled || failed}
                    onPointerDown={onWavePointerDown}
                    onPointerMove={onWavePointerMove}
                    onPointerUp={endScrub}
                    onPointerCancel={endScrub}
                    onKeyDown={onWaveKeyDown}
                    className={cn(
                        "relative h-7 touch-pan-y select-none rounded-sm outline-none focus-visible:ring-2",
                        failed ? "cursor-default opacity-40" : "cursor-pointer",
                        colors.wave,
                        colors.ring
                    )}
                >
                    <div className="absolute inset-0 opacity-35">
                        <WaveformBars bars={bars} />
                    </div>
                    {/* The same bars again at full strength, clipped to how far the audio has played. */}
                    <div
                        className="absolute inset-0"
                        style={{ clipPath: "inset(0 calc(100% - var(--progress, 0) * 100%) 0 0)" }}
                    >
                        <WaveformBars bars={bars} />
                    </div>
                </div>

                <div className={cn("flex min-h-3 items-center justify-between text-[10px] leading-none tabular-nums", colors.text)}>
                    <span>{failed ? "Couldn't play" : formatDuration(shownTime) || "0:00"}</span>

                    {!failed && (playing || rate !== 1) && (
                        <button
                            type="button"
                            onClick={cycleRate}
                            aria-label={`Playback speed ${rate}x. Change speed`}
                            // The label is tiny; the invisible ::before grows the touch target.
                            className={cn(
                                "relative rounded-full bg-current/15 px-1.5 py-0.5 font-semibold outline-none before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] focus-visible:ring-2",
                                colors.ring
                            )}
                        >
                            {rate}×
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
