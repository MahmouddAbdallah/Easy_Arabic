"use client";

import { useRef, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "cn";
import type { CallActions } from "../hooks/useCall";
import { useAudioLevel } from "../hooks/useCallMedia";
import { useAudioOutput, useMediaDevices } from "../hooks/useMediaDevices";
import { usePanelDismiss } from "../hooks/usePanelDismiss";
import type { CallSessionState } from "../lib/callController";
import type { MediaDeviceOption } from "../lib/callMedia";

/** The id of the menu, for the button that opens it. There is only ever one call screen. */
export const DEVICE_MENU_ID = "call-device-menu";

/** How loud the microphone is right now, in five steps: proof that the right one is picked. */
function LevelMeter({ stream }: { stream: MediaStream | null }) {
    const lit = Math.round(useAudioLevel(stream) * 5);
    return (
        <div aria-hidden className="flex h-1.5 gap-1">
            {Array.from({ length: 5 }, (_, index) => (
                <span
                    key={index}
                    className={cn("h-full flex-1 rounded-full transition-colors duration-100 motion-reduce:transition-none", index < lit ? "bg-emerald-400" : "bg-white/15")}
                />
            ))}
        </div>
    );
}

interface DeviceSelectProps {
    id: string;
    label: string;
    value: string;
    options: MediaDeviceOption[];
    onChange: (deviceId: string) => void;
    children?: ReactNode;
}

function DeviceSelect({ id, label, value, options, onChange, children }: DeviceSelectProps) {
    // A device that isn't listed (yet) must not leave the select showing something else than what is in use.
    const shown = options.some((option) => option.id === value) ? value : (options[0]?.id ?? "");
    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className="text-xs font-medium text-white/60">
                {label}
            </label>
            <div className="relative">
                <select
                    id={id}
                    value={shown}
                    disabled={options.length === 0}
                    onChange={(event) => onChange(event.target.value)}
                    className="w-full appearance-none truncate rounded-lg bg-white/10 py-2 pr-9 pl-3 text-sm text-white outline-none ring-1 ring-white/15 transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/80 disabled:opacity-50 [&>option]:bg-zinc-900 [&>option]:text-white"
                >
                    {options.length === 0 ? (
                        <option value="">None found</option>
                    ) : (
                        options.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.label}
                            </option>
                        ))
                    )}
                </select>
                <ChevronDownIcon aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-white/60" />
            </div>
            {children}
        </div>
    );
}

interface DeviceMenuProps {
    call: CallSessionState;
    actions: Pick<CallActions, "selectMicrophone" | "selectCamera">;
    /** The speaker choice, from `useAudioOutput`: it needs the element that plays the call's sound. */
    output: ReturnType<typeof useAudioOutput>;
    onClose: () => void;
}

/**
 * Which microphone, camera and speaker the call uses. A device that is plugged in or unplugged shows up (or goes)
 * while the menu is open. What is chosen is remembered for the next call.
 */
export function DeviceMenu({ call, actions, output, onClose }: DeviceMenuProps) {
    const root = useRef<HTMLDivElement>(null);
    usePanelDismiss(root, onClose);
    const devices = useMediaDevices(true);
    const isVideo = call.mode === "video";

    return (
        <div
            ref={root}
            id={DEVICE_MENU_ID}
            role="group"
            aria-label="Audio and video settings"
            className="absolute top-[calc(env(safe-area-inset-top,0px)_+_4.25rem)] right-4 z-40 max-h-[calc(100%_-_8rem)] w-[min(20rem,calc(100%_-_2rem))] origin-top-right space-y-4 overflow-y-auto rounded-2xl bg-zinc-900/95 p-4 text-sm text-white shadow-2xl ring-1 ring-white/15 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none"
        >
            <h3 className="font-semibold">Audio and video</h3>

            <DeviceSelect id="call-microphone" label="Microphone" value={call.microphoneId ?? ""} options={devices.microphones} onChange={actions.selectMicrophone}>
                <LevelMeter stream={call.localStream} />
                {call.muted && <p className="text-xs text-white/55">You&apos;re muted, so nobody hears this.</p>}
            </DeviceSelect>

            {isVideo && (
                <DeviceSelect id="call-camera" label="Camera" value={call.cameraId ?? ""} options={devices.cameras} onChange={actions.selectCamera} />
            )}

            {output.supported && (
                <DeviceSelect id="call-speaker" label="Speaker" value={output.speakerId || "default"} options={devices.speakers} onChange={(id) => void output.select(id)} />
            )}
        </div>
    );
}
