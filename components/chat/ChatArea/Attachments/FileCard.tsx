"use client";

import { DownloadIcon, LoaderCircleIcon } from "lucide-react";
import { cn } from "cn";
import { formatFileSize } from "../../lib/attachments";
import { useAttachmentDownload } from "../../hooks/useAttachmentDownload";
import type { MessageAttachment } from "../../types";
import { getFileVisual } from "./fileIcons";

interface FileCardProps {
    attachment: MessageAttachment;
    isMe: boolean;
}

/** A document in a message: icon, name, type and size. Tap to open it, or use the download button. */
export function FileCard({ attachment, isMe }: FileCardProps) {
    const { download, isDownloading } = useAttachmentDownload();
    const { Icon, tone, label } = getFileVisual(attachment.fileName);
    const name = attachment.fileName ?? "File";
    const url = attachment.url;
    const meta = url ? [label, formatFileSize(attachment.fileSize)].filter(Boolean).join(" · ") : "No longer available";

    const content = (
        <>
            <span
                className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-lg",
                    isMe ? "bg-white/15 text-primary-foreground" : tone
                )}
            >
                <Icon className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
                {/* dir="auto": Arabic and mixed-script names read in their own direction. */}
                <span dir="auto" className="truncate text-[12px] font-medium leading-tight" title={name}>
                    {name}
                </span>
                <span className={cn("mt-0.5 truncate text-[10px]", isMe ? "opacity-80" : "text-muted-foreground")}>
                    {meta}
                </span>
            </span>
        </>
    );

    return (
        <div
            className={cn(
                "flex min-w-0 items-center rounded-xl border transition-colors",
                isMe ? "border-white/15 bg-black/10" : "border-border/30 bg-background/40 hover:bg-background/60"
            )}
        >
            {url ? (
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${name}`}
                    className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {content}
                </a>
            ) : (
                <div className="flex min-h-14 min-w-0 flex-1 items-center gap-3 p-2 opacity-70">{content}</div>
            )}

            {url && (
                <button
                    type="button"
                    onClick={() => download(attachment)}
                    disabled={isDownloading}
                    aria-label={`Download ${name}`}
                    title="Download"
                    className={cn(
                        "mr-1 grid size-11 shrink-0 place-items-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 md:size-10",
                        isMe ? "hover:bg-white/15" : "hover:bg-muted"
                    )}
                >
                    {isDownloading ? <LoaderCircleIcon className="size-4 animate-spin" /> : <DownloadIcon className="size-4" />}
                </button>
            )}
        </div>
    );
}
