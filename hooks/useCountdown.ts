'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Countdown based on an absolute end time (not on counting ticks), so it stays
 * correct when the tab is throttled or the laptop sleeps.
 * `remaining` is whole seconds left (0 = finished / idle).
 */
export function useCountdown() {
    const [endsAt, setEndsAt] = useState<number | null>(null);
    const [remaining, setRemaining] = useState(0);

    useEffect(() => {
        if (endsAt === null) return;
        const tick = () => {
            const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
            setRemaining(left);
            if (left === 0) setEndsAt(null);
        };
        tick();
        const id = setInterval(tick, 250);
        return () => clearInterval(id);
    }, [endsAt]);

    const start = useCallback((seconds: number) => {
        setEndsAt(Date.now() + Math.max(1, seconds) * 1000);
        setRemaining(Math.max(1, Math.ceil(seconds)));
    }, []);
    const clear = useCallback(() => { setEndsAt(null); setRemaining(0); }, []);

    return { remaining, active: remaining > 0, start, clear };
}
