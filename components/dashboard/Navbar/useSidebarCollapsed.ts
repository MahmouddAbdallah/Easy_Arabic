"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "dashboard:sidebar-collapsed";

const listeners = new Set<() => void>();
/** Used when localStorage is unavailable (private mode, blocked storage): lasts until reload. */
let memoryValue = false;

function read(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
        return memoryValue;
    }
}

function subscribe(onChange: () => void) {
    listeners.add(onChange);
    // Keeps several open tabs in step.
    window.addEventListener("storage", onChange);
    return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onChange);
    };
}

/**
 * Whether the desktop sidebar is collapsed to its icon rail, remembered across visits.
 *
 * The server (and the first client render) always see "expanded"; React then switches to the
 * stored value right after hydration, so there is never a hydration mismatch.
 */
export function useSidebarCollapsed() {
    const collapsed = useSyncExternalStore(subscribe, read, () => false);

    const setCollapsed = useCallback((next: boolean) => {
        memoryValue = next;
        try {
            localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
        } catch {
            // storage unavailable: the in-memory value above still applies for this visit
        }
        listeners.forEach((listener) => listener());
    }, []);

    return [collapsed, setCollapsed] as const;
}
