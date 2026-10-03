import { VOICE_WAVEFORM_BARS } from "./attachments";

/**
 * Browser-side helpers for recording voice messages. Plain functions (no React) so they stay easy
 * to reason about; the recorder hook (hooks/useVoiceRecorder.ts) puts them together.
 */

/**
 * Formats to record in, best first. WebM/Opus is what Chrome, Edge, Firefox and Android record; Safari
 * and iOS only know MP4/AAC. The first one the browser supports wins; if none is listed the browser
 * is asked for its own default.
 */
const RECORDER_MIME_CANDIDATES = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg",
] as const;

/** Speech needs little: 32 kbps Opus sounds clear and keeps a 10 minute message around 2.4 MB. AAC needs more for the same quality. */
export const OPUS_BITS_PER_SECOND = 32_000;
export const AAC_BITS_PER_SECOND = 64_000;

/** Does this browser have everything a recording needs (microphone access + MediaRecorder)? */
export function isVoiceRecordingSupported(): boolean {
    return (
        typeof window !== "undefined" &&
        typeof MediaRecorder !== "undefined" &&
        typeof navigator !== "undefined" &&
        typeof navigator.mediaDevices?.getUserMedia === "function"
    );
}

/** Why recording can't work here, in words for the user. */
export function getUnsupportedMessage(): string {
    if (typeof window !== "undefined" && window.isSecureContext === false) {
        return "Voice messages need a secure (HTTPS) connection.";
    }
    return "Voice messages aren't supported in this browser.";
}

/** The best format this browser can record in, or undefined to let it choose. */
export function pickRecorderMimeType(): string | undefined {
    if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
    return RECORDER_MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

/**
 * "audio/webm;codecs=opus" -> "audio/webm". Some browsers label an audio-only recording "video/webm";
 * that is corrected, because it is audio.
 */
export function toBaseAudioMimeType(mimeType: string | undefined): string {
    const base = (mimeType ?? "").split(";")[0].trim().toLowerCase();
    if (!base) return "audio/webm";
    return base.replace(/^video\//, "audio/");
}

/** The microphone-related error as a message that tells the user what to do. */
export function getMicrophoneErrorMessage(error: unknown): string {
    const name = (error as { name?: string } | null)?.name;

    switch (name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
        case "SecurityError":
            return typeof window !== "undefined" && window.isSecureContext === false
                ? "Voice messages need a secure (HTTPS) connection."
                : "Microphone access is blocked. Allow it for this site in your browser settings, then try again.";
        case "NotFoundError":
        case "DevicesNotFoundError":
        case "OverconstrainedError":
            return "No microphone was found. Connect one and try again.";
        case "NotReadableError":
        case "TrackStartError":
        case "AbortError":
            return "Your microphone is busy or unavailable. Close other apps that use it and try again.";
        default:
            return "Couldn't start recording. Please try again.";
    }
}

/* -------------------------------------------------------------------------------------------------
 * Loudness
 * ---------------------------------------------------------------------------------------------- */

/**
 * How loud the last moment was, 0-1, from an analyser's time-domain bytes (128 = silence). The square
 * root of the RMS follows what the ear hears better than the raw value, so quiet speech still moves the bars.
 */
export function measureLevel(samples: Uint8Array): number {
    if (samples.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
        const centered = (samples[i] - 128) / 128;
        sum += centered * centered;
    }
    return Math.min(1, Math.sqrt(Math.sqrt(sum / samples.length)) * 1.4);
}

/** No bar is ever drawn thinner than this (percent), so silence still shows as a line of dots. */
const WAVEFORM_FLOOR = 8;

/**
 * All the loudness readings of a recording -> `bars` values (0-100) for the stored waveform. Each bar
 * is the RMS of its slice of the recording; the loudest bar is scaled to 100, so a quiet speaker
 * gets a waveform as readable as a loud one. (A near-silent recording is not blown up into noise.)
 */
export function buildWaveform(levels: readonly number[], bars: number = VOICE_WAVEFORM_BARS): number[] {
    if (levels.length === 0) return Array.from({ length: bars }, () => WAVEFORM_FLOOR);

    const slices: number[] = [];
    for (let bar = 0; bar < bars; bar++) {
        const start = Math.floor((bar * levels.length) / bars);
        const end = Math.max(start + 1, Math.floor(((bar + 1) * levels.length) / bars));
        let sum = 0;
        let count = 0;
        for (let i = start; i < end && i < levels.length; i++) {
            sum += levels[i] * levels[i];
            count++;
        }
        slices.push(Math.sqrt(sum / Math.max(count, 1)));
    }

    const loudest = Math.max(...slices, 0.05);
    return slices.map((slice) => Math.max(WAVEFORM_FLOOR, Math.round(Math.min(1, slice / loudest) * 100)));
}
