"use client";

import { useEffect, useState } from "react";
import { isSameDay, msUntilNextDay } from "../lib/dateSeparators";

/** Lets the timer land just AFTER midnight, so the day has really changed when it fires. */
const MIDNIGHT_SLACK_MS = 100;

/**
 * The current date, replaced by a fresh one only when the calendar day changes (so it re-renders at most once a day).
 *
 * A chat left open overnight must flip "Today" to "Yesterday" by itself. A timer alone isn't enough: browsers
 * throttle timers in background tabs and pause them while a laptop sleeps, so the day is also re-checked
 * whenever the tab or window comes back.
 */
export function useToday(): Date {
    const [today, setToday] = useState(() => new Date());

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;

        const refresh = () => {
            const now = new Date();
            setToday((current) => (isSameDay(current, now) ? current : now));
        };

        // Always aims at the NEXT midnight from the real clock, so a timer that fires early or late corrects itself.
        const schedule = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                refresh();
                schedule();
            }, msUntilNextDay(new Date()) + MIDNIGHT_SLACK_MS);
        };

        const onReturn = () => {
            if (document.visibilityState !== "visible") return;
            refresh();
            schedule();
        };

        schedule();
        document.addEventListener("visibilitychange", onReturn);
        window.addEventListener("focus", onReturn);

        return () => {
            clearTimeout(timer);
            document.removeEventListener("visibilitychange", onReturn);
            window.removeEventListener("focus", onReturn);
        };
    }, []);

    return today;
}
