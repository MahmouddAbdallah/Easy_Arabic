"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { COMPOSER_TOAST_POSITION } from "../lib/constants";
import type { MessageAttachment } from "../types";

/**
 * Saves an attachment under its original name. The file is fetched and handed to the browser as a
 * download (the `download` attribute alone is ignored for another site's URL, so a plain link
 * would just open it). If that isn't possible the file is opened in a new tab instead.
 */
export function useAttachmentDownload() {
    const [isDownloading, setIsDownloading] = useState(false);

    const download = useCallback(async (attachment: MessageAttachment) => {
        const url = attachment.url;
        if (!url) return;

        setIsDownloading(true);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const objectUrl = URL.createObjectURL(await response.blob());

            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = attachment.fileName ?? "download";
            link.rel = "noopener";
            document.body.appendChild(link);
            link.click();
            link.remove();
            // Give the browser time to start reading the blob before it is released.
            setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
        } catch {
            // Blocked (CORS, offline, restricted file type...): let the browser handle the link itself.
            const opened = window.open(url, "_blank", "noopener,noreferrer");
            toast.error(
                opened
                    ? "Couldn't download the file, so it was opened in a new tab."
                    : "Couldn't download this file. Try opening it instead.",
                { position: COMPOSER_TOAST_POSITION }
            );
        } finally {
            setIsDownloading(false);
        }
    }, []);

    return { download, isDownloading };
}
