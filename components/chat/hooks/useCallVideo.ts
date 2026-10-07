"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import toast from "react-hot-toast";
import { useAttachedStream } from "./useCallMedia";

export interface VideoSize {
    width: number;
    height: number;
}

const NO_SIZE: VideoSize = { width: 0, height: 0 };

/** Controls fade out after this long without a touch, a mouse move or a key. */
const IDLE_HIDE_MS = 4000;

/**
 * The size of the picture a <video> is showing (not of the element). It follows the camera: it changes when a
 * phone is turned, when the other side switches cameras, or when the sender's resolution moves up or down.
 */
export function useVideoSize(ref: RefObject<HTMLVideoElement | null>): VideoSize {
    const [size, setSize] = useState<VideoSize>(NO_SIZE);

    useEffect(() => {
        const video = ref.current;
        if (!video) return;
        const read = () => {
            const { videoWidth: width, videoHeight: height } = video;
            setSize((previous) => (previous.width === width && previous.height === height ? previous : { width, height }));
        };
        read();
        const events = ["loadedmetadata", "resize", "playing", "emptied"] as const;
        events.forEach((name) => video.addEventListener(name, read));
        return () => events.forEach((name) => video.removeEventListener(name, read));
    }, [ref]);

    return size;
}

/** The size of an element, following layout changes. */
export function useElementSize(ref: RefObject<HTMLElement | null>): VideoSize {
    const [size, setSize] = useState<VideoSize>(NO_SIZE);

    useEffect(() => {
        const element = ref.current;
        if (!element || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setSize((previous) => (Math.abs(previous.width - width) < 1 && Math.abs(previous.height - height) < 1 ? previous : { width, height }));
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref]);

    return size;
}

/** A stream shown in a <video>, plus the size of its picture. */
export function useAttachedVideo(stream: MediaStream | null) {
    const attached = useAttachedStream<HTMLVideoElement>(stream);
    const size = useVideoSize(attached.ref);
    return { ...attached, size };
}

/**
 * Controls that get out of the way: while `enabled`, they hide after a few seconds of nothing happening, and
 * come back on any sign of life (or a tap). While not enabled they are simply always there.
 */
export function useIdleControls(enabled: boolean, delay = IDLE_HIDE_MS) {
    const [hidden, setHidden] = useState(false);
    const [wasEnabled, setWasEnabled] = useState(enabled);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastWake = useRef(0);

    // Whenever hiding switches on or off, start from "shown".
    if (wasEnabled !== enabled) {
        setWasEnabled(enabled);
        setHidden(false);
    }

    const clear = useCallback(() => {
        if (timer.current !== null) clearTimeout(timer.current);
        timer.current = null;
    }, []);

    const arm = useCallback(() => {
        clear();
        timer.current = setTimeout(() => setHidden(true), delay);
    }, [clear, delay]);

    useEffect(() => {
        if (enabled) arm();
        else clear();
        return clear;
    }, [enabled, arm, clear]);

    /** Any sign of life: show the controls and restart the countdown. */
    const wake = useCallback(() => {
        const now = Date.now();
        if (now - lastWake.current < 200) return; // a pointer move fires dozens of times a second
        lastWake.current = now;
        setHidden(false);
        if (enabled) arm();
    }, [enabled, arm]);

    /** A tap on the picture itself: hide the controls, or bring them back. */
    const toggle = useCallback(() => {
        if (!enabled) return;
        lastWake.current = Date.now();
        if (hidden) {
            setHidden(false);
            arm();
        } else {
            setHidden(true);
            clear();
        }
    }, [enabled, hidden, arm, clear]);

    return { visible: !enabled || !hidden, wake, toggle };
}

/**
 * Picture-in-picture for the other person's video, where the browser has it. With `autoEnter`, leaving the
 * tab opens the floating window by itself (Chrome and Edge let video-call sites opt in to that).
 */
export function usePictureInPicture(videoRef: RefObject<HTMLVideoElement | null>, autoEnter: boolean) {
    const supported = typeof document !== "undefined" && document.pictureInPictureEnabled === true;
    const [active, setActive] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !supported) return;
        const entered = () => setActive(true);
        const left = () => setActive(false);
        video.addEventListener("enterpictureinpicture", entered);
        video.addEventListener("leavepictureinpicture", left);
        return () => {
            video.removeEventListener("enterpictureinpicture", entered);
            video.removeEventListener("leavepictureinpicture", left);
            // The call screen is going away: the floating window must not outlive it.
            if (document.pictureInPictureElement === video) void document.exitPictureInPicture().catch(() => undefined);
        };
    }, [videoRef, supported]);

    useEffect(() => {
        if (!supported || !autoEnter || !("mediaSession" in navigator)) return;
        const action = "enterpictureinpicture" as MediaSessionAction;
        try {
            navigator.mediaSession.setActionHandler(action, () => {
                void videoRef.current?.requestPictureInPicture().catch(() => undefined);
            });
        } catch {
            return; // this browser doesn't know the action
        }
        return () => {
            try {
                navigator.mediaSession.setActionHandler(action, null);
            } catch {
                /* nothing to undo */
            }
        };
    }, [videoRef, supported, autoEnter]);

    const toggle = useCallback(async () => {
        const video = videoRef.current;
        if (!video) return;
        try {
            if (document.pictureInPictureElement) await document.exitPictureInPicture();
            else await video.requestPictureInPicture();
        } catch {
            toast.error("Picture-in-picture isn't available right now.", { id: "call-pip" });
        }
    }, [videoRef]);

    return { supported, active, toggle };
}

/** Full screen for an element (the call panel), where the browser has it: not on iPhones, which only do it for plain videos. */
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
    const supported = typeof document !== "undefined" && document.fullscreenEnabled === true;
    const [active, setActive] = useState(false);

    useEffect(() => {
        const element = ref.current;
        const sync = () => setActive(document.fullscreenElement === element);
        document.addEventListener("fullscreenchange", sync);
        return () => {
            document.removeEventListener("fullscreenchange", sync);
            if (document.fullscreenElement === element) void document.exitFullscreen().catch(() => undefined);
        };
    }, [ref]);

    const toggle = useCallback(async () => {
        const element = ref.current;
        if (!element) return;
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await element.requestFullscreen({ navigationUI: "hide" });
        } catch {
            /* refused (a browser setting, or not triggered by a tap): nothing to do */
        }
    }, [ref]);

    return { supported, active, toggle };
}
