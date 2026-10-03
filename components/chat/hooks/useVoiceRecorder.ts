"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { MAX_VOICE_SECONDS, MIN_VOICE_SECONDS, validateVoiceFile } from "../lib/attachments";
import {
    AAC_BITS_PER_SECOND,
    OPUS_BITS_PER_SECOND,
    buildWaveform,
    getMicrophoneErrorMessage,
    getUnsupportedMessage,
    isVoiceRecordingSupported,
    measureLevel,
    pickRecorderMimeType,
    toBaseAudioMimeType,
} from "../lib/voice";

/** idle -> requesting (the browser's permission prompt) -> recording -> recorded (ready to preview / send). */
export type RecorderStatus = "idle" | "requesting" | "recording" | "recorded";

/** A finished recording, kept in memory until it is sent or thrown away. */
export interface VoiceRecording {
    /** Tells one recording from the next (an upload belongs to exactly one). */
    id: string;
    file: File;
    /** Canonical audio MIME type, e.g. "audio/webm". */
    mimeType: string;
    /** Seconds, measured while recording (a browser recording has no reliable length of its own). */
    duration: number;
    /** VOICE_WAVEFORM_BARS values, 0-100. */
    waveform: number[];
    /** Object URL for the local preview. Revoked when the recording is discarded. */
    previewUrl: string;
}

/** Bars the live waveform shows; `levelsRef` always holds this many values, newest last. */
export const LIVE_WAVEFORM_BARS = 32;

/** One loudness reading every 80 ms: 12 a second is plenty for 40 bars and cheap to take. */
const SAMPLE_MS = 80;
/** Ask for a data chunk every 250 ms, so a recording is never one big buffer that can be lost. */
const CHUNK_MS = 250;

interface Options {
    /** A message for the user: permission denied, no microphone, recording failed, too short... */
    onError: (message: string) => void;
    /** The recording hit MAX_VOICE_SECONDS and was stopped (it is kept, ready to send). */
    onLimitReached?: () => void;
}

/** Everything that belongs to ONE recording attempt. */
interface Engine {
    session: number;
    stream: MediaStream;
    recorder: MediaRecorder;
    mimeType: string;
    chunks: Blob[];
    /** Every loudness reading, for the stored waveform. */
    levels: number[];
    timer: ReturnType<typeof setInterval> | null;
    startedAt: number;
    stoppedAt: number | null;
    lastSecond: number;
    /** Throw the result away (cancel). */
    discard: boolean;
    /** The recorder reported a failure. */
    failed: boolean;
    /** finalize() ran: the result was handed over (or refused) and must not be produced twice. */
    done: boolean;
    waiters: Array<(recording: VoiceRecording | null) => void>;
    onTrackEnded: () => void;
}

const makeId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const stopTracks = (stream: MediaStream) => stream.getTracks().forEach((track) => track.stop());

const subscribeNever = () => () => undefined;

/** An AudioContext, if the browser has one. Only used to read the loudness: the audio is never played through it. */
function createAudioContext(): AudioContext | null {
    try {
        const Context =
            window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        return Context ? new Context() : null;
    } catch {
        return null;
    }
}

/**
 * Records a voice message from the microphone.
 *
 *  - `start()` asks for the microphone (the browser shows its permission prompt) and begins recording.
 *  - `stop()` ends the recording and resolves with it (or null when it was too short / failed).
 *  - `cancel()` throws everything away, from any state, and releases the microphone.
 *
 * The microphone is released the moment recording ends, on cancel, when the component unmounts, and
 * if the device disappears. The live waveform is handed over through `levelsRef` (not state) so
 * drawing it never re-renders the composer; only the whole-second timer does.
 */
export function useVoiceRecorder({ onError, onLimitReached }: Options) {
    const [status, setStatus] = useState<RecorderStatus>("idle");
    const [elapsed, setElapsed] = useState(0);
    const [recording, setRecording] = useState<VoiceRecording | null>(null);

    // Server render and first client render both say "supported"; the real answer arrives right after.
    const supported = useSyncExternalStore(subscribeNever, isVoiceRecordingSupported, () => true);

    const statusRef = useRef<RecorderStatus>("idle");
    const recordingRef = useRef<VoiceRecording | null>(null);
    const levelsRef = useRef<number[]>(Array.from({ length: LIVE_WAVEFORM_BARS }, () => 0));
    const engineRef = useRef<Engine | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    /** Bumped by start() and cancel(): work that began before that (a permission prompt, a stop) is stale. */
    const sessionRef = useRef(0);

    // The callbacks are read through refs so start/stop/cancel keep their identity.
    const onErrorRef = useRef(onError);
    const onLimitRef = useRef(onLimitReached);
    useEffect(() => {
        onErrorRef.current = onError;
        onLimitRef.current = onLimitReached;
    });

    const changeStatus = useCallback((next: RecorderStatus) => {
        statusRef.current = next;
        setStatus(next);
    }, []);

    const closeAudioContext = useCallback(() => {
        const context = audioContextRef.current;
        audioContextRef.current = null;
        if (context && context.state !== "closed") context.close().catch(() => undefined);
    }, []);

    /** Stops the timer, frees the microphone and the audio graph. Safe to call twice. */
    const releaseEngine = useCallback(
        (engine: Engine) => {
            if (engine.timer) clearInterval(engine.timer);
            engine.timer = null;
            for (const track of engine.stream.getAudioTracks()) track.removeEventListener("ended", engine.onTrackEnded);
            stopTracks(engine.stream);
            closeAudioContext();
            if (engineRef.current === engine) engineRef.current = null;
        },
        [closeAudioContext]
    );

    const clearRecording = useCallback(() => {
        if (recordingRef.current) URL.revokeObjectURL(recordingRef.current.previewUrl);
        recordingRef.current = null;
        setRecording(null);
    }, []);

    /** The recorder has stopped: turn the chunks into a VoiceRecording (or explain why not). */
    const finalize = useCallback(
        (engine: Engine) => {
            if (engine.done) return;
            engine.done = true;
            releaseEngine(engine);
            const waiters = engine.waiters.splice(0);
            const settle = (result: VoiceRecording | null) => waiters.forEach((resolve) => resolve(result));

            // Cancelled, or replaced by a newer attempt: nobody is waiting for this one.
            if (engine.discard || engine.session !== sessionRef.current) return settle(null);

            const fail = (message: string) => {
                changeStatus("idle");
                setElapsed(0);
                onErrorRef.current(message);
                settle(null);
            };

            if (engine.failed) return fail("The recording failed. Please try again.");

            const seconds = ((engine.stoppedAt ?? performance.now()) - engine.startedAt) / 1000;
            if (seconds < MIN_VOICE_SECONDS) return fail("That was too short. Record a little longer.");

            const blob = new Blob(engine.chunks, { type: engine.mimeType });
            if (blob.size === 0) return fail("Nothing was recorded. Check your microphone and try again.");

            // The same rules the server applies, so a recording that would be refused is caught here.
            const check = validateVoiceFile({ name: "voice-message", size: blob.size, type: engine.mimeType });
            if (!check.ok) return fail(check.message);

            const file = new File([blob], `voice-message.${check.extension}`, { type: check.mimeType });
            const duration = Math.round(Math.min(seconds, MAX_VOICE_SECONDS) * 10) / 10;
            const result: VoiceRecording = {
                id: makeId(),
                file,
                mimeType: check.mimeType,
                duration,
                waveform: buildWaveform(engine.levels),
                previewUrl: URL.createObjectURL(file),
            };

            recordingRef.current = result;
            setRecording(result);
            setElapsed(Math.floor(duration));
            changeStatus("recorded");
            settle(result);
        },
        [changeStatus, releaseEngine]
    );

    const start = useCallback(async () => {
        if (statusRef.current !== "idle") return;
        if (!isVoiceRecordingSupported()) {
            onErrorRef.current(getUnsupportedMessage());
            return;
        }

        const session = ++sessionRef.current;
        changeStatus("requesting");
        setElapsed(0);
        levelsRef.current = Array.from({ length: LIVE_WAVEFORM_BARS }, () => 0);

        // Created now, still inside the tap: Safari only lets an AudioContext run if it starts from a gesture.
        const audioContext = createAudioContext();
        audioContextRef.current = audioContext;
        audioContext?.resume().catch(() => undefined);

        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: { ideal: 1 },
                },
            });
        } catch (error) {
            if (session !== sessionRef.current) return; // cancelled while the prompt was open
            closeAudioContext();
            changeStatus("idle");
            onErrorRef.current(getMicrophoneErrorMessage(error));
            return;
        }

        // Cancelled while the prompt was open: the user said yes, but doesn't want it any more.
        if (session !== sessionRef.current) {
            stopTracks(stream);
            return;
        }

        const preferred = pickRecorderMimeType();
        let recorder: MediaRecorder;
        try {
            recorder = new MediaRecorder(stream, {
                ...(preferred ? { mimeType: preferred } : {}),
                audioBitsPerSecond: preferred?.startsWith("audio/mp4") ? AAC_BITS_PER_SECOND : OPUS_BITS_PER_SECOND,
            });
        } catch {
            try {
                recorder = new MediaRecorder(stream); // the browser's own default
            } catch {
                stopTracks(stream);
                closeAudioContext();
                changeStatus("idle");
                onErrorRef.current(getUnsupportedMessage());
                return;
            }
        }

        // Loudness metering is a nicety: without it the waveform is flat but the recording is fine.
        let analyser: AnalyserNode | null = null;
        let samples: Uint8Array<ArrayBuffer> | null = null;
        try {
            if (audioContext) {
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 512;
                analyser.smoothingTimeConstant = 0.3;
                audioContext.createMediaStreamSource(stream).connect(analyser); // never connected to the speakers
                samples = new Uint8Array(analyser.fftSize);
            }
        } catch {
            analyser = null;
            samples = null;
        }

        const engine: Engine = {
            session,
            stream,
            recorder,
            mimeType: toBaseAudioMimeType(recorder.mimeType || preferred),
            chunks: [],
            levels: [],
            timer: null,
            startedAt: performance.now(),
            stoppedAt: null,
            lastSecond: -1,
            discard: false,
            failed: false,
            done: false,
            waiters: [],
            onTrackEnded: () => {
                // The microphone went away (unplugged, permission revoked, the OS took it): keep what we have.
                if (engine.recorder.state === "inactive") return;
                onErrorRef.current("Your microphone was disconnected, so the recording was stopped.");
                engine.stoppedAt = performance.now();
                engine.recorder.stop();
            },
        };
        engineRef.current = engine;

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) engine.chunks.push(event.data);
        };
        recorder.onerror = () => {
            engine.failed = true;
            if (recorder.state !== "inactive") recorder.stop();
            else finalize(engine);
        };
        recorder.onstop = () => finalize(engine);
        recorder.onstart = () => {
            engine.startedAt = performance.now();
            changeStatus("recording");
        };
        for (const track of stream.getAudioTracks()) track.addEventListener("ended", engine.onTrackEnded);

        const tick = () => {
            const seconds = (performance.now() - engine.startedAt) / 1000;

            let level = 0.25; // no meter: a calm, flat line instead of invented movement
            if (analyser && samples) {
                analyser.getByteTimeDomainData(samples);
                level = measureLevel(samples);
            }
            engine.levels.push(level);
            const live = levelsRef.current;
            live.push(level);
            if (live.length > LIVE_WAVEFORM_BARS) live.shift();

            const whole = Math.floor(seconds);
            if (whole !== engine.lastSecond) {
                engine.lastSecond = whole;
                setElapsed(whole);
            }

            if (seconds >= MAX_VOICE_SECONDS && engine.recorder.state === "recording") {
                engine.stoppedAt = performance.now();
                engine.recorder.stop();
                onLimitRef.current?.();
            }
        };

        try {
            recorder.start(CHUNK_MS);
        } catch {
            releaseEngine(engine);
            changeStatus("idle");
            onErrorRef.current("Couldn't start recording. Please try again.");
            return;
        }
        engine.timer = setInterval(tick, SAMPLE_MS);
    }, [changeStatus, closeAudioContext, finalize, releaseEngine]);

    const stop = useCallback((): Promise<VoiceRecording | null> => {
        const engine = engineRef.current;
        // Nothing is recording: whatever was recorded before (if anything) is the answer.
        if (!engine || engine.recorder.state === "inactive") return Promise.resolve(recordingRef.current);

        return new Promise((resolve) => {
            engine.waiters.push(resolve);
            engine.stoppedAt ??= performance.now();
            engine.recorder.stop();
        });
    }, []);

    const cancel = useCallback(() => {
        sessionRef.current++; // a pending permission prompt or stop is now stale

        const engine = engineRef.current;
        if (engine) {
            engine.discard = true;
            try {
                if (engine.recorder.state !== "inactive") engine.recorder.stop();
            } catch {
                // already stopped
            }
            releaseEngine(engine);
            engine.waiters.splice(0).forEach((resolve) => resolve(null));
        }
        closeAudioContext(); // also covers a cancel during the permission prompt

        clearRecording();
        setElapsed(0);
        changeStatus("idle");
    }, [changeStatus, clearRecording, closeAudioContext, releaseEngine]);

    // Leaving the chat or the page never leaves the microphone on.
    useEffect(() => cancel, [cancel]);

    return { status, elapsed, recording, levelsRef: levelsRef as RefObject<number[]>, supported, start, stop, cancel };
}

export type VoiceRecorder = ReturnType<typeof useVoiceRecorder>;
