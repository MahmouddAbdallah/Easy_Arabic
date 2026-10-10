"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { onValue, ref } from "firebase/database";
import { firebaseClientDBRealTime } from "@/lib/config/firebase-client";
import { useUserPresence } from "./useUserPresence";

/**
 * How the signed-in user's own presence reads:
 *  - `online` / `offline`  what the shared presence system says, i.e. what other people see for this account;
 *  - `connecting`          no trustworthy answer yet (still connecting, or the first answer has not arrived);
 *  - `no-network`          the browser has no network, so nothing it says about "online" can be believed;
 *  - `unavailable`         the presence node can't be read at all.
 */
export type SelfPresenceStatus = "connecting" | "no-network" | "online" | "offline" | "unavailable";

export const SELF_PRESENCE_LABEL: Record<SelfPresenceStatus, string> = {
    connecting: "Connecting…",
    "no-network": "Waiting for network…",
    online: "Online",
    offline: "Offline",
    unavailable: "Status unavailable",
};

/**
 * On start-up the stored status is still last session's "offline" until the app context has registered its
 * disconnect handler and written "online" (a round trip). An "offline" that doesn't last this long is that
 * hand-off, not a real state, so it is shown as "connecting" instead of flashing.
 */
const OFFLINE_GRACE_MS = 1500;

function subscribeToNetwork(onChange: () => void) {
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
    };
}
const getBrowserOnline = () => navigator.onLine;
const getBrowserOnlineOnServer = () => true;

export interface SelfPresence {
    status: SelfPresenceStatus;
    label: string;
}

/**
 * The status of the signed-in user, from the application's presence system (the `status/{userId}` node that
 * AppContext keeps up to date and `useUserPresence` reads) plus the connection to the database: while that is
 * down, the node's last value is only a cached copy and says nothing about right now.
 */
export function useSelfPresence(userId: string | null | undefined): SelfPresence {
    const presence = useUserPresence(userId);
    const browserOnline = useSyncExternalStore(subscribeToNetwork, getBrowserOnline, getBrowserOnlineOnServer);
    const [connection, setConnection] = useState<{ userId: string; connected: boolean } | null>(null);
    const [offlineSettled, setOfflineSettled] = useState(false);

    useEffect(() => {
        if (!userId) return;
        return onValue(
            ref(firebaseClientDBRealTime, ".info/connected"),
            (snapshot) => setConnection({ userId, connected: snapshot.val() === true }),
            (error) => {
                console.error("Error listening to the connection state: ", error);
                setConnection({ userId, connected: false });
            }
        );
    }, [userId]);

    const connected = connection && connection.userId === userId ? connection.connected : null;

    let raw: SelfPresenceStatus;
    if (!browserOnline) raw = "no-network";
    else if (presence.failed) raw = "unavailable";
    else if (connected !== true || !presence.known) raw = "connecting";
    else raw = presence.online ? "online" : "offline";

    useEffect(() => {
        if (raw !== "offline") {
            setOfflineSettled(false);
            return;
        }
        const timer = setTimeout(() => setOfflineSettled(true), OFFLINE_GRACE_MS);
        return () => clearTimeout(timer);
    }, [raw]);

    const status: SelfPresenceStatus = raw === "offline" && !offlineSettled ? "connecting" : raw;

    return useMemo(() => ({ status, label: SELF_PRESENCE_LABEL[status] }), [status]);
}
