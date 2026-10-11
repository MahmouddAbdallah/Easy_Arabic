"use client";

import { useEffect, type RefObject } from "react";

/** Marks the button that opens a panel: a press on it is the button's to handle, not an outside press. */
export const PANEL_TOGGLE_ATTRIBUTE = "data-panel-toggle";

/** Closes a floating panel on a press outside it, or on Escape. */
export function usePanelDismiss(root: RefObject<HTMLElement | null>, onClose: () => void) {
    useEffect(() => {
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Element | null;
            if (!target || root.current?.contains(target) || target.closest(`[${PANEL_TOGGLE_ATTRIBUTE}]`)) return;
            onClose();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            onClose();
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [root, onClose]);
}
