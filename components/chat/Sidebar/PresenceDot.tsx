"use client";

import type { ComponentProps } from "react";
import { cn } from "cn";
import { SELF_PRESENCE_LABEL, type SelfPresenceStatus } from "../hooks/useSelfPresence";

const DOT_COLOR: Record<SelfPresenceStatus, string> = {
    online: "bg-emerald-500",
    offline: "bg-muted-foreground/60",
    connecting: "animate-pulse bg-muted-foreground/40 motion-reduce:animate-none",
    "no-network": "bg-amber-500",
    unavailable: "bg-muted-foreground/40",
};

const LABEL_COLOR: Record<SelfPresenceStatus, string> = {
    online: "text-emerald-600 dark:text-emerald-400",
    offline: "text-muted-foreground",
    connecting: "text-muted-foreground",
    "no-network": "text-amber-600 dark:text-amber-400",
    unavailable: "text-muted-foreground",
};

interface PresenceDotProps {
    status: SelfPresenceStatus;
    className?: string;
}

/**
 * The status dot in the corner of an avatar. Purely visual (the text next to it says the same thing in
 * words), so it is hidden from screen readers; the colour is never the only signal.
 */
export function PresenceDot({ status, className }: PresenceDotProps) {
    return (
        <span
            aria-hidden="true"
            data-status={status}
            className={cn(
                "absolute -end-px -bottom-px block size-3 rounded-full ring-2 ring-background transition-colors duration-300 motion-reduce:transition-none",
                DOT_COLOR[status],
                className
            )}
        />
    );
}

/** The status in words, in the colour that goes with it. */
export function PresenceLabel({ status, className, ...props }: ComponentProps<"span"> & { status: SelfPresenceStatus }) {
    return (
        <span {...props} className={cn("transition-colors duration-300 motion-reduce:transition-none", LABEL_COLOR[status], className)}>
            {SELF_PRESENCE_LABEL[status]}
        </span>
    );
}
