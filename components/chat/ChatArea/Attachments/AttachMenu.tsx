"use client";

import { useRef, useState } from "react";
import { FileTextIcon, ImageIcon, PaperclipIcon, VideoIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENT_BYTES, formatFileSize } from "../../lib/attachments";
import type { AttachmentType } from "../../types";

const OPTIONS: Array<{ type: AttachmentType; label: string; hint: string; Icon: LucideIcon; tone: string }> = [
    {
        type: "image",
        label: "Photos",
        hint: `JPG, PNG, WebP, GIF · up to ${formatFileSize(MAX_ATTACHMENT_BYTES.image)}`,
        Icon: ImageIcon,
        tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    },
    {
        type: "video",
        label: "Videos",
        hint: `MP4, MOV, WebM · up to ${formatFileSize(MAX_ATTACHMENT_BYTES.video)}`,
        Icon: VideoIcon,
        tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    },
    {
        type: "file",
        label: "Documents",
        hint: `PDF, Word, Excel, ZIP · up to ${formatFileSize(MAX_ATTACHMENT_BYTES.file)}`,
        Icon: FileTextIcon,
        tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    },
];

interface AttachMenuProps {
    disabled?: boolean;
    onFiles: (files: File[]) => void;
}

/** The paperclip: a small menu to pick photos, videos or documents (the phone's own pickers open). */
export function AttachMenu({ disabled, onFiles }: AttachMenuProps) {
    const [open, setOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // One hidden input serves all three choices; only what it accepts changes. Calling click()
    // inside the tap handler keeps the browser's "user gesture" requirement satisfied.
    const pick = (type: AttachmentType) => {
        const input = inputRef.current;
        if (!input) return;
        input.accept = ATTACHMENT_ACCEPT[type];
        setOpen(false);
        input.click();
    };

    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger
                    render={
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={disabled}
                            aria-label="Attach photos, videos or files"
                            className="size-11 shrink-0 rounded-xl text-muted-foreground hover:text-foreground md:size-8"
                        />
                    }
                >
                    <PaperclipIcon className="size-4" />
                </PopoverTrigger>
                <PopoverContent side="top" align="start" sideOffset={10} className="w-[min(18rem,calc(100vw-2rem))] gap-0.5 p-1.5">
                    {OPTIONS.map(({ type, label, hint, Icon, tone }) => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => pick(type)}
                            className="flex min-h-12 w-full items-center gap-3 rounded-lg p-2 text-left outline-none transition-colors hover:bg-muted focus-visible:bg-muted"
                        >
                            <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", tone)}>
                                <Icon className="size-4.5" />
                            </span>
                            <span className="flex min-w-0 flex-col">
                                <span className="text-[13px] font-medium leading-tight">{label}</span>
                                <span className="truncate text-[11px] text-muted-foreground">{hint}</span>
                            </span>
                        </button>
                    ))}
                </PopoverContent>
            </Popover>

            <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = ""; // choosing the same file again must fire onChange again
                    if (files.length > 0) onFiles(files);
                }}
            />
        </>
    );
}
