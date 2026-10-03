"use client";

import { MicOffIcon } from "lucide-react";
import { getAudioSources } from "../../lib/attachmentUrls";
import type { MessageAttachment } from "../../types";
import { VoicePlayer } from "./VoicePlayer";

interface VoiceMessageProps {
    attachment: MessageAttachment;
    isMe: boolean;
}

/** A voice message inside a bubble: the player, or a note when the recording is gone. */
export function VoiceMessage({ attachment, isMe }: VoiceMessageProps) {
    const [primary, fallback] = getAudioSources(attachment);

    if (!primary) {
        return (
            <p className="flex items-center gap-2 py-1 text-[11px] italic opacity-80">
                <MicOffIcon className="size-4 shrink-0" />
                Voice message no longer available
            </p>
        );
    }

    return (
        <VoicePlayer
            // A different recording is a different player: nothing carries over from the previous one.
            key={attachment.publicId ?? primary.src}
            src={primary.src}
            type={primary.type}
            fallbackSrc={fallback?.src}
            fallbackType={fallback?.type}
            duration={attachment.duration}
            waveform={attachment.waveform}
            seed={attachment.publicId ?? primary.src}
            tone={isMe ? "own" : "other"}
            className="py-0.5"
        />
    );
}
