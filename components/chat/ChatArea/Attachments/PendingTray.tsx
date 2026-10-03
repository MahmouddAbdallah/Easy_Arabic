"use client";

import { useState } from "react";
import { AlertCircleIcon, CheckIcon, ImageIcon, LoaderCircleIcon, PlayIcon, RotateCwIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { formatFileSize } from "../../lib/attachments";
import type { PendingAttachment } from "../../hooks/useAttachmentUploads";
import { getFileVisual } from "./fileIcons";

interface PendingTrayProps {
    items: PendingAttachment[];
    /** While the message is being sent the attachments can't change. */
    locked: boolean;
    onRemove: (id: string) => void;
    onRetry: (id: string) => void;
}

const isWorking = (item: PendingAttachment) => item.status === "queued" || item.status === "uploading";

/** Circular progress; a spinner while there is nothing to measure yet (waiting, or Cloudinary is finishing up). */
function ProgressRing({ progress, indeterminate }: { progress: number; indeterminate: boolean }) {
    const radius = 13;
    const circumference = 2 * Math.PI * radius;
    return (
        <span
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={indeterminate ? undefined : progress}
            aria-label="Uploading"
            className="relative grid size-9 place-items-center text-white"
        >
            {indeterminate ? (
                <LoaderCircleIcon className="size-6 animate-spin" />
            ) : (
                <>
                    <svg viewBox="0 0 32 32" className="absolute inset-0 -rotate-90">
                        <circle cx="16" cy="16" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                        <circle
                            cx="16"
                            cy="16"
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={circumference * (1 - progress / 100)}
                            className="transition-[stroke-dashoffset] duration-200"
                        />
                    </svg>
                    <span className="text-[9px] font-semibold tabular-nums">{progress}</span>
                </>
            )}
        </span>
    );
}

function RemoveButton({ item, disabled, onRemove }: { item: PendingAttachment; disabled: boolean; onRemove: () => void }) {
    return (
        <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label={`Remove ${item.fileName}`}
            // The circle is 24px; the invisible ::before grows the touch target to 44px.
            className="absolute -right-1.5 -top-1.5 z-10 grid size-6 place-items-center rounded-full bg-foreground/85 text-background shadow-sm outline-none transition-colors before:absolute before:-inset-2.5 before:content-[''] hover:bg-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
            <XIcon className="size-3.5" />
        </button>
    );
}

function RetryButton({ item, disabled, onRetry, className }: { item: PendingAttachment; disabled: boolean; onRetry: () => void; className?: string }) {
    return (
        <button
            type="button"
            onClick={onRetry}
            disabled={disabled}
            aria-label={`Retry uploading ${item.fileName}`}
            title="Retry"
            className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                className
            )}
        >
            <RotateCwIcon className="size-4" />
        </button>
    );
}

/** A photo or video: square thumbnail with the upload state drawn over it. */
function MediaThumb({ item, locked, onRemove, onRetry }: { item: PendingAttachment; locked: boolean; onRemove: () => void; onRetry: () => void }) {
    const [broken, setBroken] = useState(false); // e.g. a HEIC photo: not every browser can draw it locally
    const working = isWorking(item);

    return (
        <div className="relative">
            <div
                className="relative size-16 overflow-hidden rounded-xl border border-border/40 bg-muted sm:size-18"
                title={item.error ?? item.fileName}
            >
                {item.previewUrl && !broken ? (
                    item.type === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.previewUrl} alt="" draggable={false} onError={() => setBroken(true)} className="size-full object-cover" />
                    ) : (
                        <video
                            src={`${item.previewUrl}#t=0.1`}
                            muted
                            playsInline
                            preload="metadata"
                            onError={() => setBroken(true)}
                            className="size-full object-cover"
                        />
                    )
                ) : (
                    <span className="grid size-full place-items-center text-muted-foreground">
                        <ImageIcon className="size-6" />
                    </span>
                )}

                {item.type === "video" && !working && item.status !== "error" && (
                    <span className="absolute bottom-1 left-1 grid size-5 place-items-center rounded-full bg-black/60 text-white">
                        <PlayIcon className="size-2.5 fill-current" />
                    </span>
                )}

                {working && (
                    <span className="absolute inset-0 grid place-items-center bg-black/45">
                        <ProgressRing progress={item.progress} indeterminate={item.status === "queued" || item.progress >= 99 || item.progress === 0} />
                    </span>
                )}

                {item.status === "error" && (
                    <span className="absolute inset-0 grid place-items-center bg-destructive/75 text-white">
                        {item.retryable ? (
                            <RetryButton item={item} disabled={locked} onRetry={onRetry} className="bg-white/90 text-destructive hover:bg-white" />
                        ) : (
                            <AlertCircleIcon className="size-6" />
                        )}
                    </span>
                )}

                {item.status === "done" && (
                    <span className="absolute bottom-1 right-1 grid size-4 place-items-center rounded-full bg-emerald-500 text-white shadow">
                        <CheckIcon className="size-2.5" strokeWidth={3.5} />
                    </span>
                )}
            </div>
            <RemoveButton item={item} disabled={locked} onRemove={onRemove} />
        </div>
    );
}

/** A document: a compact card with its icon, name and upload state. */
function FileChip({ item, locked, onRemove, onRetry }: { item: PendingAttachment; locked: boolean; onRemove: () => void; onRetry: () => void }) {
    const { Icon, tone, label } = getFileVisual(item.fileName);
    const working = isWorking(item);

    return (
        <div className="relative">
            <div className="flex h-16 w-52 items-center gap-2.5 rounded-xl border border-border/40 bg-background/60 p-2 sm:w-60">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", tone)}>
                    <Icon className="size-5" />
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span dir="auto" className="truncate text-xs font-medium leading-tight" title={item.fileName}>
                        {item.fileName}
                    </span>

                    {item.status === "error" ? (
                        <span className="truncate text-[10px] text-destructive" title={item.error ?? undefined}>
                            {item.error}
                        </span>
                    ) : working ? (
                        <>
                            <span className="text-[10px] text-muted-foreground">
                                {item.status === "queued" ? "Waiting…" : item.progress >= 99 ? "Processing…" : `Uploading ${item.progress}%`}
                            </span>
                            <span
                                role="progressbar"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={item.progress}
                                aria-label={`Uploading ${item.fileName}`}
                                className="h-1 overflow-hidden rounded-full bg-border"
                            >
                                <span className="block h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${item.progress}%` }} />
                            </span>
                        </>
                    ) : (
                        <span className="truncate text-[10px] text-muted-foreground">
                            {[label, formatFileSize(item.file.size)].join(" · ")}
                        </span>
                    )}
                </span>

                {item.status === "error" && item.retryable && (
                    <RetryButton item={item} disabled={locked} onRetry={onRetry} className="bg-destructive/10 text-destructive hover:bg-destructive/20" />
                )}
                {item.status === "done" && (
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
                        <CheckIcon className="size-3" strokeWidth={3.5} />
                    </span>
                )}
            </div>
            <RemoveButton item={item} disabled={locked} onRemove={onRemove} />
        </div>
    );
}

/**
 * The attachments waiting to be sent: a compact, horizontally scrolling strip (so a phone's screen
 * isn't taken over), each with its own progress, retry and remove, and one line saying where things stand.
 */
export function PendingTray({ items, locked, onRemove, onRetry }: PendingTrayProps) {
    if (items.length === 0) return null;

    const working = items.filter(isWorking);
    const failed = items.filter((item) => item.status === "error").length;
    const average = working.length ? Math.round(working.reduce((sum, item) => sum + item.progress, 0) / working.length) : 0;

    return (
        <div className="min-w-0 rounded-2xl border border-border/40 bg-muted/30 p-2" role="group" aria-label="Attachments to send">
            {/*
              w-0 + min-w-full: the strip fills the tray but adds nothing to its parents' intrinsic width.
              Without it ten attachments make the whole composer (and the Send button) wider than a phone.
              pt-4 leaves room for the remove buttons' 44px touch area, which overflow-x would otherwise clip.
            */}
            <ul className="flex w-0 min-w-full gap-3 overflow-x-auto overscroll-x-contain px-1.5 pb-1 pt-4 [scrollbar-width:thin]">
                {items.map((item) => (
                    <li key={item.id} className="shrink-0">
                        {item.type === "file" ? (
                            <FileChip item={item} locked={locked} onRemove={() => onRemove(item.id)} onRetry={() => onRetry(item.id)} />
                        ) : (
                            <MediaThumb item={item} locked={locked} onRemove={() => onRemove(item.id)} onRetry={() => onRetry(item.id)} />
                        )}
                    </li>
                ))}
            </ul>

            <p
                role="status"
                aria-live="polite"
                className={cn(
                    "flex items-center gap-1.5 px-1.5 pb-0.5 pt-1 text-[11px]",
                    failed > 0 ? "text-destructive" : "text-muted-foreground"
                )}
            >
                {failed > 0 ? (
                    <>
                        <AlertCircleIcon className="size-3.5 shrink-0" />
                        <span>
                            {failed === 1 ? "1 file didn't upload." : `${failed} files didn't upload.`} Retry or remove {failed === 1 ? "it" : "them"} to send.
                        </span>
                    </>
                ) : working.length > 0 ? (
                    <>
                        <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin" />
                        <span>
                            Uploading {working.length} {working.length === 1 ? "file" : "files"}… {average}%
                        </span>
                    </>
                ) : (
                    <>
                        <CheckIcon className="size-3.5 shrink-0 text-emerald-500" />
                        <span>{items.length === 1 ? "Ready to send" : `${items.length} files ready to send`}</span>
                    </>
                )}
            </p>
        </div>
    );
}
