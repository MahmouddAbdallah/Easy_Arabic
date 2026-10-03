"use client";

import React, { useMemo, useState } from "react";
import { cn } from "cn";
import { isMediaAttachment, isVoiceAttachment } from "../lib/attachments";
import type { MessageAttachment } from "../types";
import { FileCard } from "./Attachments/FileCard";
import { MediaGrid } from "./Attachments/MediaGrid";
import { MediaViewer } from "./Attachments/MediaViewer";
import { VoiceMessage } from "./Voice/VoiceMessage";

export interface AttachmentItem {
    attachments: MessageAttachment[];
    isMe: boolean;
}

/**
 * Everything attached to one message: photos and videos as a responsive grid (tap to open the
 * viewer, a single video plays inline), voice messages as audio players and documents as file cards.
 */
const Attachment: React.FC<AttachmentItem> = ({ attachments, isMe }) => {
    const [viewerIndex, setViewerIndex] = useState<number | null>(null);
    const media = useMemo(() => attachments.filter(isMediaAttachment), [attachments]);
    const voices = useMemo(() => attachments.filter(isVoiceAttachment), [attachments]);
    const files = useMemo(() => attachments.filter((attachment) => attachment.type === "file"), [attachments]);

    if (attachments.length === 0) return null;

    // A voice message on its own needs far less room than a photo grid.
    const voiceOnly = voices.length === attachments.length;

    return (
        // A fixed width (never wider than the bubble) keeps media from sizing the bubble by its pixels.
        // Taps here belong to the attachments: they must not also toggle the bubble's touch toolbar.
        <div
            className={cn(
                "flex max-w-full flex-col gap-1.5",
                voiceOnly ? "w-64 md:w-72" : "w-70 md:w-80"
            )}
            onPointerUp={(event) => event.stopPropagation()}
        >
            {media.length > 0 && <MediaGrid media={media} onOpen={setViewerIndex} />}

            {voices.map((voice, index) => (
                <VoiceMessage key={voice.publicId ?? voice.url ?? index} attachment={voice} isMe={isMe} />
            ))}

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
