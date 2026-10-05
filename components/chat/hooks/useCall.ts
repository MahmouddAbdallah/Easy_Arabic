"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { CallMode, CallPeer } from "../lib/call";
import { IDLE_CALL_STATE, type CallController, type CallSessionState } from "../lib/callController";

/** Set by <CallProvider>. One controller serves the whole page. */
export const CallControllerContext = createContext<CallController | null>(null);

function useController(): CallController {
    const controller = useContext(CallControllerContext);
    if (!controller) throw new Error("Call hooks must be used within a CallProvider");
    return controller;
}

/** The whole call state. It changes a lot, so use it for the call screen, not for buttons. */
export function useCallState(): CallSessionState {
    const controller = useController();
    return useSyncExternalStore(controller.subscribe, controller.getSnapshot, () => IDLE_CALL_STATE);
}

/**
 * One value out of the call state. The component only re-renders when that value changes, so it must
 * be a primitive: `useCallSelector((call) => call.phase !== "idle")`.
 */
export function useCallSelector<T extends string | number | boolean | null>(select: (call: CallSessionState) => T): T {
    const controller = useController();
    return useSyncExternalStore(
        controller.subscribe,
        () => select(controller.getSnapshot()),
        () => select(IDLE_CALL_STATE)
    );
}

export interface CallActions {
    startCall: (peer: CallPeer, mode: CallMode) => void;
    acceptCall: () => void;
    declineCall: () => void;
    endCall: () => void;
    toggleMute: () => void;
    toggleCamera: () => void;
    switchCamera: () => void;
    dismissEnded: () => void;
}

/** What a person can do in a call. Stable: using it never causes a re-render. */
export function useCallActions(): CallActions {
    const controller = useController();
    return useMemo<CallActions>(
        () => ({
            startCall: (peer, mode) => void controller.startCall(peer, mode),
            acceptCall: () => void controller.acceptCall(),
            declineCall: () => controller.declineCall(),
            endCall: () => controller.endCall(),
            toggleMute: () => controller.toggleMute(),
            toggleCamera: () => void controller.toggleCamera(),
            switchCamera: () => void controller.switchCamera(),
            dismissEnded: () => controller.dismissEnded(),
        }),
        [controller]
    );
}
