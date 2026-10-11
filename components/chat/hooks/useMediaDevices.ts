"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import toast from "react-hot-toast";
import { NO_DEVICES, canChooseSpeaker, listMediaDevices, readDevicePreferences, rememberDevice, type MediaDeviceLists } from "../lib/callMedia";

/**
 * The microphones, cameras and speakers on this computer, kept current: plugging in a headset or unplugging a
 * webcam updates the lists. Nothing is asked of the browser while `active` is false, so a call whose device menu
 * is never opened never enumerates anything.
 */
export function useMediaDevices(active: boolean): MediaDeviceLists {
    const [devices, setDevices] = useState<MediaDeviceLists>(NO_DEVICES);

    useEffect(() => {
        if (!active || typeof navigator === "undefined" || !navigator.mediaDevices) return;
        let cancelled = false;
        const refresh = () => {
            void listMediaDevices().then((next) => {
                if (!cancelled) setDevices(next);
            });
        };
        refresh();
        navigator.mediaDevices.addEventListener("devicechange", refresh);
        return () => {
            cancelled = true;
            navigator.mediaDevices.removeEventListener("devicechange", refresh);
        };
    }, [active]);

    return devices;
}

type SinkElement = HTMLMediaElement & { setSinkId?: (sinkId: string) => Promise<void> };

/**
 * Which speaker the call's sound comes out of (`setSinkId`: Chrome and Edge). The choice is remembered for the next
 * call; a speaker that has been unplugged since falls back to the system's default.
 */
export function useAudioOutput(ref: RefObject<HTMLMediaElement | null>) {
    const supported = canChooseSpeaker();
    const [speakerId, setSpeakerId] = useState<string>(() => (supported ? (readDevicePreferences().speaker ?? "") : ""));

    const apply = useCallback(
        async (sinkId: string): Promise<boolean> => {
            const element = ref.current as SinkElement | null;
            if (!element?.setSinkId) return false;
            try {
                await element.setSinkId(sinkId);
                return true;
            } catch {
                return false;
            }
        },
        [ref]
    );

    // The element lives as long as the call screen: the remembered speaker is applied once, when it appears.
    useEffect(() => {
        if (!supported || !speakerId) return;
        void apply(speakerId).then((worked) => {
            if (worked) return;
            setSpeakerId("");
            rememberDevice("speaker", null);
        });
    }, [supported, apply]);

    const select = useCallback(
        async (sinkId: string) => {
            if (await apply(sinkId)) {
                setSpeakerId(sinkId);
                rememberDevice("speaker", sinkId);
            } else {
                toast.error("Couldn't switch the speaker. Please try again.", { id: "call-speaker-error" });
            }
        },
        [apply]
    );

    return { supported, speakerId, select };
}
