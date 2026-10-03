"use client";

import { useEffect, useRef, useState } from "react";

const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

/**
 * Drag-and-drop of files anywhere on the page. Besides collecting the files, taking over the drop
 * stops the browser from navigating away to the dropped file. Returns whether files are being
 * dragged over the window (to show a drop hint).
 */
export function useFileDrop(onFiles: (files: File[]) => void, enabled: boolean): boolean {
    const [isDragging, setIsDragging] = useState(false);
    // dragenter/dragleave also fire for every element the pointer crosses: count them.
    const depth = useRef(0);

    useEffect(() => {
        if (!enabled) return;

        const onDragEnter = (event: DragEvent) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            depth.current++;
            setIsDragging(true);
        };
        const onDragOver = (event: DragEvent) => {
            if (!hasFiles(event)) return;
            event.preventDefault(); // required to allow a drop
            if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        };
        const onDragLeave = (event: DragEvent) => {
            if (!hasFiles(event)) return;
            depth.current = Math.max(0, depth.current - 1);
            if (depth.current === 0) setIsDragging(false);
        };
        const onDrop = (event: DragEvent) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            depth.current = 0;
            setIsDragging(false);
            const files = Array.from(event.dataTransfer?.files ?? []);
            if (files.length > 0) onFiles(files);
        };

        window.addEventListener("dragenter", onDragEnter);
        window.addEventListener("dragover", onDragOver);
        window.addEventListener("dragleave", onDragLeave);
        window.addEventListener("drop", onDrop);
        return () => {
            window.removeEventListener("dragenter", onDragEnter);
            window.removeEventListener("dragover", onDragOver);
            window.removeEventListener("dragleave", onDragLeave);
            window.removeEventListener("drop", onDrop);
            depth.current = 0;
            setIsDragging(false);
        };
    }, [enabled, onFiles]);

    return isDragging;
}
