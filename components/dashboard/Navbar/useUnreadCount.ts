"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseClientDB } from "@/lib/config/firebase-client";
import { useAppContext } from "@/components/AppContext";

/** Per-user counter documents (`{ count: number }`, keyed by user id). */
export const UNREAD_MESSAGES_COLLECTION = "unreadMessageCount";

/**
 * Live value of one of the per-user unread counters. The document does not exist until the user's
 * first unread item, so a missing document (or any listener error) reads as 0.
 */
export function useUnreadCount(collectionName: string): number {
    const { user } = useAppContext();
    const userId = user?.id;
    const [state, setState] = useState<{ userId: string; count: number } | null>(null);

    useEffect(() => {
        if (!userId) return;
        return onSnapshot(
            doc(firebaseClientDB, collectionName, userId),
            (snapshot) => {
                const count = snapshot.get("count");
                setState({ userId, count: typeof count === "number" && count > 0 ? count : 0 });
            },
            (error) => console.error(`[dashboard] Could not listen to ${collectionName}:`, error)
        );
    }, [userId, collectionName]);

    // Ignore a value that belongs to a previous user (sign-out / account switch).
    return userId && state?.userId === userId ? state.count : 0;
}
