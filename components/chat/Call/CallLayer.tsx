"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useCallActions, useCallState } from "../hooks/useCall";
import { useWakeLock } from "../hooks/useCallMedia";
import { CallScreen } from "./CallScreen";
import { IncomingCallCard } from "./IncomingCallCard";

const subscribeToNothing = () => () => undefined;
/** false while rendering on the server, true in the browser: portals need a document. */
const useIsClient = () => useSyncExternalStore(subscribeToNothing, () => true, () => false);

/**
 * Everything a call puts on screen. It renders into <body>, so no ancestor (the chat panel clips and
 * blurs its content) can crop or reposition it.
 */
export function CallLayer() {
    const call = useCallState();
    const actions = useCallActions();
    const isClient = useIsClient();

    const showScreen = call.phase !== "idle" && call.phase !== "incoming";
    // A phone that locks its screen cuts the call: keep it awake while one is on.
    useWakeLock(showScreen && call.phase !== "ended");

    if (!isClient) return null;

    return createPortal(
        <>
            {call.phase === "incoming" && <IncomingCallCard call={call} actions={actions} />}
            {showScreen && <CallScreen key={call.mode ?? "none"} call={call} actions={actions} />}
        </>,
        document.body
    );
}
