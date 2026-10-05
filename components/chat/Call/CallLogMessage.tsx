"use client";

import { PhoneIcon, PhoneIncomingIcon, PhoneMissedIcon, PhoneOutgoingIcon, VideoIcon, VideoOffIcon } from "lucide-react";
import { cn } from "cn";
import { useCallActions, useCallSelector } from "../hooks/useCall";
import { describeCallLog, type CallLogDescription, type CallPeer } from "../lib/call";
import type { MessageType } from "../types";

const TONE_STYLES: Record<CallLogDescription["tone"], { row: string; icon: string }> = {
    ok: { row: "border-border/40 bg-muted/40", icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    neutral: { row: "border-border/40 bg-muted/40", icon: "bg-muted text-muted-foreground" },
    missed: { row: "border-destructive/25 bg-destructive/5", icon: "bg-destructive/10 text-destructive" },
};

interface CallLogMessageProps {
    message: MessageType;
    /** The other person in this conversation: who "Call back" calls. */
    peer: CallPeer | null;
}

/** What a finished call looks like in the conversation: who called, how it went, how long it lasted. */
export function CallLogMessage({ message, peer }: CallLogMessageProps) {
    const call = message.call;
    const { startCall } = useCallActions();
    const inCall = useCallSelector((state) => state.phase !== "idle");
    if (!call) return null;

    const outgoing = message.isMe;
    const { title, detail, tone, canCallBack } = describeCallLog(call, outgoing);
    const isVideo = call.mode === "video";
    const styles = TONE_STYLES[tone];

    const Icon =
        tone === "missed"
            ? isVideo
                ? VideoOffIcon
                : PhoneMissedIcon
            : isVideo
              ? VideoIcon
              : outgoing
                ? PhoneOutgoingIcon
                : PhoneIncomingIcon;
    const CallBackIcon = isVideo ? VideoIcon : PhoneIcon;

    return (
        <div className="flex justify-center py-1" role="status">
            <div className={cn("flex max-w-full items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-xs backdrop-blur-md", styles.row)}>
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", styles.icon)}>
                    <Icon className="size-4" aria-hidden />
                </span>

                <div className="min-w-0">
                    <p className={cn("truncate font-semibold", tone === "missed" && "text-destructive")}>{title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                        {[detail, message.time].filter(Boolean).join(" · ")}
                    </p>
                </div>

                {canCallBack && peer && (
                    <button
                        type="button"
                        disabled={inCall}
                        onClick={() => startCall(peer, call.mode)}
                        className="ml-1 flex shrink-0 items-center gap-1.5 rounded-full border border-border/50 bg-background/60 px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                    >
                        <CallBackIcon className="size-3.5" aria-hidden />
                        Call back
                    </button>
                )}
            </div>
        </div>
    );
}
