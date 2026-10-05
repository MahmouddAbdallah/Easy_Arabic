"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { measureLevel } from "../lib/voice";

/** Seconds since `since` (a timestamp), ticking once a second. 0 while `since` is null. */
export function useElapsedSeconds(since: number | null): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (since === null) return;
        setNow(Date.now());
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [since]);

    return since === null ? 0 : Math.max(0, Math.floor((now - since) / 1000));
}

/**
 * Plays `stream` in the element behind `ref`. Browsers may refuse to start sound without a tap, which
 * is reported as `blocked`; `resume()` (call it from a click) starts it.
 */
export function useAttachedStream<T extends HTMLMediaElement>(stream: MediaStream | null) {
    const ref = useRef<T>(null);
    const [blocked, setBlocked] = useState(false);

    const resume = useCallback(() => {
        const element = ref.current;
        if (!element?.srcObject) return;
        element
            .play()
            .then(() => setBlocked(false))
            .catch((error: { name?: string }) => {
                if (error?.name === "NotAllowedError") setBlocked(true);
            });
    }, []);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        element.srcObject = stream;
        if (stream) resume();
        return () => {
            element.srcObject = null;
        };
    }, [stream, resume]);

    return { ref, blocked, resume };
}

/** Keeps the screen awake while `active` (a phone that locks its screen cuts the call). Best effort. */
export function useWakeLock(active: boolean) {
    useEffect(() => {
        if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

        let lock: WakeLockSentinel | null = null;
        let cancelled = false;

        const acquire = async () => {
            try {
                const next = await navigator.wakeLock.request("screen");
                if (cancelled) void next.release().catch(() => undefined);
                else lock = next;
            } catch {
                /* refused (battery saver, ...): the call still works */
            }
        };
        // The lock is released by the browser whenever the page is hidden: take it again when it is back.
        const onVisible = () => {
            if (document.visibilityState === "visible") void acquire();
        };

        void acquire();
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            cancelled = true;
            document.removeEventListener("visibilitychange", onVisible);
            void lock?.release().catch(() => undefined);
        };
    }, [active]);
}

/** How loud `stream` is right now, 0 to 1 in steps of 0.2: enough to make an avatar pulse while someone talks. */
export function useAudioLevel(stream: MediaStream | null): number {
    const [level, setLevel] = useState(0);

    useEffect(() => {
        if (!stream || stream.getAudioTracks().length === 0) {
            setLevel(0);
            return;
        }
        const Ctor =
            window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;

        let context: AudioContext;
        try {
            context = new Ctor();
        } catch {
            return;
        }
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const samples = new Uint8Array(analyser.fftSize);
        let frame = 0;
        let lastRun = 0;
        let current = 0;

        const tick = (time: number) => {
            frame = requestAnimationFrame(tick);
            if (time - lastRun < 80) return; // ~12 updates a second is plenty
            lastRun = time;
            analyser.getByteTimeDomainData(samples);
            const next = Math.round(measureLevel(samples) * 5) / 5;
            if (next !== current) {
                current = next;
                setLevel(next);
            }
        };
        frame = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(frame);
            source.disconnect();
            void context.close().catch(() => undefined);
            setLevel(0);
        };
    }, [stream]);

    return level;
}
