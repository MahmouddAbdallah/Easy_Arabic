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
 *
 * Also here: what a call asks of the microphone, which devices a person can choose between (and which they
 * chose last time), and how a screen is captured. Everything in this file only runs in a browser.
 */

export type CameraFacing = "user" | "environment";

/**
 * Which camera to open: one device, or whichever faces a direction. `exact` makes the browser fail instead of
 * settling for another camera. A device defaults to exact (the person picked it); a remembered one from an
 * earlier call is only a preference (`exact: false`): it is tried first, and the front camera is used if it has
 * been unplugged since.
 *
 * (A device is always asked for with `exact`, never `ideal`: Chrome ignores `ideal` for `deviceId`, so a
 * "preferred" camera or microphone requested that way is silently replaced by the default.)
 */
export type CameraTarget = { deviceId: string; exact?: boolean } | { facing: CameraFacing; exact?: boolean };

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
    const profile = captureProfile();
    const attempts = (identity: VideoConstraints): VideoConstraints[] => [
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

    if ("deviceId" in target) {
        const device = attempts({ deviceId: { exact: target.deviceId } });
        // A remembered camera that is gone ends in a constraint error, which moves on to the next attempt.
        return target.exact === false ? [...device, ...attempts({ facingMode: "user" })] : device;
    }
    return attempts({ facingMode: target.exact ? { exact: target.facing } : target.facing });
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

/* -------------------------------------------------------------------------------------------------
 * The microphone
 * ---------------------------------------------------------------------------------------------- */

export interface MicrophoneTarget {
    deviceId: string;
    /**
     * Default: fail instead of settling for another microphone (the person picked this one). `false`: a preference
     * remembered from an earlier call, used if that microphone is still there, otherwise the system's own.
     */
    exact?: boolean;
}

/**
 * What a call asks of the microphone: the browser's own echo cancellation, noise suppression and level control
 * (all `ideal`, so a device that can't do one of them still opens), and a single voice channel. A phone call
 * has no use for stereo, and one channel is half the processing. A `deviceId` is always `exact`: Chrome ignores
 * `ideal` there (see CameraTarget).
 */
export function microphoneConstraints(deviceId?: string): MediaTrackConstraints {
    return {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: { ideal: 1 },
        ...(deviceId ? { deviceId: { exact: deviceId } } : null),
    };
}

/**
 * Runs `open` with the microphone in `target`. A remembered one (`exact: false`) is tried first; if it is gone, `open`
 * runs again with the system's default, so a stale preference never keeps a call from starting.
 */
export async function withMicrophone<T>(target: MicrophoneTarget | undefined, open: (audio: MediaTrackConstraints) => Promise<T>): Promise<T> {
    if (target?.exact !== false) return open(microphoneConstraints(target?.deviceId));
    try {
        return await open(microphoneConstraints(target.deviceId));
    } catch (error) {
        if (!isConstraintError(error)) throw error;
        return open(microphoneConstraints());
    }
}

/** A microphone carries speech: say so, so the encoder and the browser's processing treat it as such. */
export function tuneAudioTrack(track: MediaStreamTrack): void {
    try {
        track.contentHint = "speech";
    } catch {
        /* not every browser has the property */
    }
}

/* -------------------------------------------------------------------------------------------------
 * Which devices, and which ones were chosen last time
 * ---------------------------------------------------------------------------------------------- */

export type DeviceKind = "microphone" | "camera" | "speaker";
export type DevicePreferences = Partial<Record<DeviceKind, string>>;

const DEVICE_KINDS: readonly DeviceKind[] = ["microphone", "camera", "speaker"];
const DEVICE_PREFERENCES_KEY = "chat-call-devices-v1";

/** The devices the person picked in an earlier call. Never throws: storage can be blocked or full. */
export function readDevicePreferences(): DevicePreferences {
    if (typeof window === "undefined") return {};
    try {
        const raw = window.localStorage.getItem(DEVICE_PREFERENCES_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== "object") return {};
        const preferences: DevicePreferences = {};
        for (const kind of DEVICE_KINDS) {
            const id = (parsed as Record<string, unknown>)[kind];
            if (typeof id === "string" && id.length > 0 && id.length <= 256) preferences[kind] = id;
        }
        return preferences;
    } catch {
        return {};
    }
}

/** Remembers a choice for the next call; `null` forgets it. Without storage the choice only lasts for this call. */
export function rememberDevice(kind: DeviceKind, deviceId: string | null): void {
    if (typeof window === "undefined") return;
    try {
        const next = { ...readDevicePreferences() };
        if (deviceId) next[kind] = deviceId;
        else delete next[kind];
        window.localStorage.setItem(DEVICE_PREFERENCES_KEY, JSON.stringify(next));
    } catch {
        /* storage unavailable */
    }
}

export interface MediaDeviceOption {
    id: string;
    label: string;
}

export interface MediaDeviceLists {
    microphones: MediaDeviceOption[];
    cameras: MediaDeviceOption[];
    speakers: MediaDeviceOption[];
}

export const NO_DEVICES: MediaDeviceLists = { microphones: [], cameras: [], speakers: [] };

/**
 * The microphones, cameras and speakers on this computer. Names are only available once the page has been
 * allowed to use a device, which is the case during a call. Never throws.
 */
export async function listMediaDevices(): Promise<MediaDeviceLists> {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const options = (kind: MediaDeviceKind, fallback: string): MediaDeviceOption[] =>
            devices
                // "communications" is a second entry for a device that is already listed.
                .filter((device) => device.kind === kind && device.deviceId && device.deviceId !== "communications")
                .map((device, index) => ({ id: device.deviceId, label: device.label || `${fallback} ${index + 1}` }));
        return { microphones: options("audioinput", "Microphone"), cameras: options("videoinput", "Camera"), speakers: options("audiooutput", "Speaker") };
    } catch {
        return NO_DEVICES;
    }
}

/** Can this browser send a call's sound to a chosen speaker? (Chrome and Edge can; Firefox and older Safari can't.) */
export function canChooseSpeaker(): boolean {
    return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
}

/* -------------------------------------------------------------------------------------------------
 * Screen sharing
 * ---------------------------------------------------------------------------------------------- */

/** Computers only: phone browsers can't capture the screen, and a button that does nothing is worse than none. */
export function canShareScreen(): boolean {
    return typeof navigator !== "undefined" && !isMobileDevice() && typeof navigator.mediaDevices?.getDisplayMedia === "function";
}

/** Chrome's extra `getDisplayMedia` options, missing from the DOM typings. Other browsers ignore them. */
type DisplayOptions = DisplayMediaStreamOptions & {
    selfBrowserSurface?: "include" | "exclude";
    surfaceSwitching?: "include" | "exclude";
    systemAudio?: "include" | "exclude";
};

/** A shared screen is text and slides: keep it sharp, and don't spend frames on it. */
export function tuneScreenTrack(track: MediaStreamTrack): void {
    try {
        track.contentHint = "detail";
    } catch {
        /* not every browser has the property */
    }
}

/**
 * Asks the person which screen, window or tab to share. Rejects with `NotAllowedError` when they cancel.
 * Must be called straight from a tap or click. Only the picture is shared.
 */
export async function openScreenStream(): Promise<MediaStream> {
    const options: DisplayOptions = {
        // The sender scales down to what the network allows; capturing more than Full HD only costs the computer effort.
        video: { frameRate: { ideal: 15, max: 30 }, width: { max: 1920 }, height: { max: 1920 } },
        audio: false,
        // Sharing the call's own tab would show the call inside the call, forever.
        selfBrowserSurface: "exclude",
        surfaceSwitching: "include",
        systemAudio: "exclude",
    };

    let stream: MediaStream;
    try {
        stream = await navigator.mediaDevices.getDisplayMedia(options);
    } catch (error) {
        if (!isConstraintError(error)) throw error;
        // A browser that can't weigh those hints still shares the screen.
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    }

    stream.getAudioTracks().forEach((track) => track.stop());
    const [video] = stream.getVideoTracks();
    if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("The browser didn't share a screen.");
    }
    tuneScreenTrack(video);
    return stream;
}
