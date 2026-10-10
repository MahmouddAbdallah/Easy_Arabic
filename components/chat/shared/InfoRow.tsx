"use client";

import type { ComponentType, ReactNode } from "react";
import toast from "react-hot-toast";
import { CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export async function copyToClipboard(value: string, label: string) {
    try {
        await navigator.clipboard.writeText(value);
        toast.success(`${label} copied.`, { id: "chat-contact-copy" });
    } catch {
        toast.error("Couldn't copy to the clipboard.", { id: "chat-contact-copy" });
    }
}

interface InfoRowProps {
    Icon: ComponentType<{ className?: string }>;
    label: string;
    children: ReactNode;
    /** Makes the row copyable. */
    copyValue?: string;
}

/** One labelled detail of a person (icon tile, label, value, optional copy button), as in the contact info. */
export function InfoRow({ Icon, label, children, copyValue }: InfoRowProps) {
    return (
        <div className="flex items-center gap-3 px-1 py-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted/60 text-muted-foreground">
                <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                <div className="truncate text-sm font-medium text-foreground select-text">{children}</div>
            </div>
            {copyValue && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Copy ${label.toLowerCase()}`}
                    title={`Copy ${label.toLowerCase()}`}
                    onClick={() => void copyToClipboard(copyValue, label)}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <CopyIcon />
                </Button>
            )}
        </div>
    );
}
