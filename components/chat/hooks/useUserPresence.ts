"use client";

import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { firebaseClientDBRealTime } from "@/lib/config/firebase-client";

export interface UserPresence {
    /** The first answer has arrived (before it, "offline" would be a guess). */
    known: boolean;
    online: boolean;
    /** When the user last changed between online and offline (ms since epoch), if ever. */
    lastChanged: number | null;
}

const UNKNOWN: UserPresence = { known: false, online: false, lastChanged: null };

// Realtime Database keys can't contain . # $ [ ] or /; ids in this app never do, anything else isn't addressable.
const SAFE_KEY = /^[A-Za-z0-9_-]+$/;

/**
 * The same `status/{userId}` node the online dot reads (written by the app context), with the time of the last
 * change as well, for "Last seen ...". Only listens while `enabled`, so a closed panel costs nothing.
 */
export function useUserPresence(userId: string | null | undefined, enabled = true): UserPresence {
    const [presence, setPresence] = useState<{ userId: string; value: UserPresence } | null>(null);

    useEffect(() => {
        if (!enabled || !userId || !SAFE_KEY.test(userId)) return;

        return onValue(
            ref(firebaseClientDBRealTime, `status/${userId}`),
            (snapshot) => {
                const status: { state?: unknown; last_changed?: unknown } | null = snapshot.val();
                setPresence({
                    userId,
                    value: {
                        known: true,
                        online: status?.state === "online",
                        lastChanged: typeof status?.last_changed === "number" ? status.last_changed : null,
                    },
                });
            },
            (error) => console.error("Error listening to the presence of a user: ", error)
        );
    }, [userId, enabled]);

    return presence && presence.userId === userId ? presence.value : UNKNOWN;
}
