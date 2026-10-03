"use client";

import React, { useMemo, useState } from "react";
import { isMediaAttachment } from "../lib/attachments";
import type { MessageAttachment } from "../types";
import { FileCard } from "./Attachments/FileCard";
import { MediaGrid } from "./Attachments/MediaGrid";
import { MediaViewer } from "./Attachments/MediaViewer";

export interface AttachmentItem {
    attachments: MessageAttachment[];
    isMe: boolean;
}

/**
 * Everything attached to one message: photos and videos as a responsive grid (tap to open the
 * viewer, a single video plays inline) and documents as file cards.
 */
const Attachment: React.FC<AttachmentItem> = ({ attachments, isMe }) => {
    const [viewerIndex, setViewerIndex] = useState<number | null>(null);
    const media = useMemo(() => attachments.filter(isMediaAttachment), [attachments]);
    const files = useMemo(() => attachments.filter((attachment) => attachment.type === "file"), [attachments]);

    if (attachments.length === 0) return null;

    return (
        // A fixed width (never wider than the bubble) keeps media from sizing the bubble by its pixels.
        // Taps here belong to the attachments: they must not also toggle the bubble's touch toolbar.
        <div className="flex w-70 max-w-full flex-col gap-1.5 md:w-80" onPointerUp={(event) => event.stopPropagation()}>
            {media.length > 0 && <MediaGrid media={media} onOpen={setViewerIndex} />}

            {files.map((file, index) => (
                <FileCard key={file.publicId ?? file.url ?? index} attachment={file} isMe={isMe} />
            ))}

            {media.length > 0 && (
                <MediaViewer
                    media={media}
                    index={viewerIndex}
                    onIndexChange={setViewerIndex}
                    onClose={() => setViewerIndex(null)}
                />
            )}
        </div>
    );
};

export default Attachment;
