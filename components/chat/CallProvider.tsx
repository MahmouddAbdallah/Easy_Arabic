"use client";

import { useContext, useEffect, useMemo, type ReactNode } from "react";
import { useAppContext } from "@/components/AppContext";
import { CallLayer } from "./Call/CallLayer";
import { CallControllerContext } from "./hooks/useCall";
import { CallController } from "./lib/callController";

function CallRoot({ children }: { children: ReactNode }) {
    const { user } = useAppContext();
    const controller = useMemo(() => new CallController(), []);
    const userId = user?.id ?? null;

    // Listening for calls starts when the user is known and stops (hanging up any call) when they go.
    useEffect(() => {
        if (!userId) return;
        controller.attach(userId);
        return () => controller.detach();
    }, [controller, userId]);

    return (
        <CallControllerContext.Provider value={controller}>
            {children}
            <CallLayer />
        </CallControllerContext.Provider>
    );
}

/**
 * Voice and video calls for everything inside it: listens for incoming calls, owns the call in progress
 * and renders its screens (<CallLayer />, in a portal). Needs <AppContext>.
 *
 * It lives inside ChatProvider, so calls ring while the chat page is open. Mounted once higher up (the
 * root layout, under the app context) the same component makes calls ring anywhere in the app; a
 * CallProvider inside another one simply passes through, so there is never a second listener.
 */
export function CallProvider({ children }: { children: ReactNode }) {
    return useContext(CallControllerContext) ? <>{children}</> : <CallRoot>{children}</CallRoot>;
}

export default CallProvider;
