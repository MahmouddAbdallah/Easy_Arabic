/**
 * Which camera settings a call asks for, and how a camera is opened.
 *
 * Why the request looks the way it does:
 *   - Only `ideal` values. A browser always finds the closest mode the camera really has, so a call never
 *     fails, or settles for a tiny picture, because one number couldn't be matched exactly.
 *   - No fixed aspect ratio and no `exact` size. Forcing 16:9 on a camera whose sensor is 4:3 makes the
 *     browser crop it, which is the "zoomed in" look. The size is only a hint of how big a picture is
 *     wanted; the camera keeps its own shape and field of view.
 *   - `resizeMode: none` (Chrome): the camera's real frames, not a cropped and rescaled copy of them.
 *   - Phones ask for 4:3, what their sensors natively produce (the widest field of view, and the same
 *     number of pixels as 16:9 for a bit less encoding work); computers ask for Full HD.
 *
 * How much of that picture is actually sent is decided later, from the network (see ./callQuality.ts).
 */

export type CameraFacing = "user" | "environment";

/** Which camera to open: one device, or whichever faces a direction (`exact` fails instead of settling for another). */
export type CameraTarget = { deviceId: string } | { facing: CameraFacing; exact?: boolean };

/** `resizeMode` is missing from the DOM typings. */
type VideoConstraints = MediaTrackConstraints & { resizeMode?: ConstrainDOMString };

interface CaptureProfile {
    /** Landscape size wanted from the camera; the browser turns it around for a phone held upright. */
    width: number;
    height: number;
    /** The most this kind of device sends: a phone gets hot and drains its battery encoding Full HD. */
    maxSendShortSide: number;
}

const DESKTOP_PROFILE: CaptureProfile = { width: 1920, height: 1080, maxSendShortSide: 1080 };
const MOBILE_PROFILE: CaptureProfile = { width: 1280, height: 960, maxSendShortSide: 720 };

const FRAME_RATE = 30;
/** A camera that can't keep this up at its first-choice size is asked for 720p instead. */
const MIN_SMOOTH_FPS = 20;
const SMOOTH_FALLBACK = { width: 1280, height: 720 };

interface NavigatorWithUserAgentData extends Navigator {
    userAgentData?: { mobile?: boolean };
}

/** A phone or a tablet (touch first), as opposed to a computer. */
export function isMobileDevice(): boolean {
    if (typeof navigator === "undefined") return false;
    const hint = (navigator as NavigatorWithUserAgentData).userAgentData?.mobile;
    if (typeof hint === "boolean") return hint;
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse) and (hover: none)").matches;
}

export const captureProfile = (): CaptureProfile => (isMobileDevice() ? MOBILE_PROFILE : DESKTOP_PROFILE);

/** The most video this device should send, as the short side of the picture in pixels. */
export const maxSendShortSide = (): number => captureProfile().maxSendShortSide;

/** The constraint sets to try for a camera, best first. */
export function cameraAttempts(target: CameraTarget = { facing: "user" }): VideoConstraints[] {
    const identity: VideoConstraints =
        "deviceId" in target
            ? { deviceId: { exact: target.deviceId } }
            : { facingMode: target.exact ? { exact: target.facing } : target.facing };
    const profile = captureProfile();

    return [
        {
            ...identity,
            width: { ideal: profile.width },
            height: { ideal: profile.height },
            frameRate: { ideal: FRAME_RATE },
            resizeMode: { ideal: "none" },
        },
        // A browser that can't weigh one of the hints above still opens the camera itself.
        identity,
    ];
}

/** The browser couldn't satisfy (or doesn't understand) a constraint: worth retrying with fewer of them. */
export function isConstraintError(error: unknown): boolean {
    const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name: unknown }).name) : "";
    return name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError" || name === "TypeError";
}

/** Opens a camera (with the microphone too, when `audio` is given). */
export async function openCameraStream(audio: MediaTrackConstraints | false, target?: CameraTarget): Promise<MediaStream> {
    let failure: unknown;
    for (const video of cameraAttempts(target)) {
        try {
            return await navigator.mediaDevices.getUserMedia({ audio, video });
        } catch (error) {
            failure = error;
            if (!isConstraintError(error)) break; // denied, busy, missing: a simpler request won't change that
        }
    }
    throw failure;
}

/** Settings that apply to every camera track, wherever it came from. */
export function tuneVideoTrack(track: MediaStreamTrack): void {
    // A face on a camera is "motion": when the network or the CPU runs short, give up sharpness before smoothness.
    try {
        track.contentHint = "motion";
    } catch {
        /* not every browser has the property */
    }
    void keepCaptureSmooth(track);
}

/** A big picture that arrives at a few frames per second is worse than a smaller smooth one. */
async function keepCaptureSmooth(track: MediaStreamTrack): Promise<void> {
    const { width, height, frameRate } = track.getSettings();
    if (!width || !height || !frameRate || frameRate >= MIN_SMOOTH_FPS || Math.min(width, height) <= 540) return;
    try {
        await track.applyConstraints({
            width: { ideal: SMOOTH_FALLBACK.width },
            height: { ideal: SMOOTH_FALLBACK.height },
            frameRate: { ideal: FRAME_RATE },
        });
    } catch {
        /* keep what the camera gives */
    }
}
