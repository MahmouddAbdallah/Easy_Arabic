"use client";

import { PhoneIcon, PhoneIncomingIcon, PhoneMissedIcon, PhoneOutgoingIcon, VideoIcon, VideoOffIcon } from "lucide-react";
import { cn } from "cn";
import { useCallActions, useCallSelector } from "../hooks/useCall";
import { describeCallLog, type CallLogDescription, type CallPeer } from "../lib/call";
import type { MessageType } from "../types";

const TONE_STYLES: Record<CallLogDescription["tone"], { row: string; icon: string }> = {
    ok: { row: "border-(--chat-line) bg-(--chat-surface)", icon: "bg-(--chat-accent-soft) text-(--chat-accent-text)" },
    neutral: { row: "border-(--chat-line) bg-(--chat-surface)", icon: "bg-(--chat-surface-3) text-(--chat-ink-2)" },
    missed: { row: "border-(--chat-danger)/25 bg-(--chat-danger-soft)", icon: "bg-(--chat-danger)/12 text-(--chat-danger)" },
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
        <div className="my-3 flex justify-center px-1" role="status">
            <div className={cn("flex max-w-full items-center gap-3 rounded-2xl border py-2 pe-2 ps-2.5 shadow-(--chat-shadow-sm)", styles.row)}>
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", styles.icon)}>
                    <Icon className="size-[18px]" aria-hidden />
                </span>

                <div className="min-w-0 pe-1">
                    <p className={cn("truncate text-sm font-semibold", tone === "missed" ? "text-(--chat-danger)" : "text-(--chat-ink)")}>{title}</p>
                    <p className="truncate text-xs text-(--chat-ink-3)">{[detail, message.time].filter(Boolean).join(" · ")}</p>
                </div>

                {canCallBack && peer && (
                    <button
                        type="button"
                        disabled={inCall}
                        onClick={() => startCall(peer, call.mode)}
                        className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-(--chat-accent-soft) px-3.5 text-[13px] font-medium text-(--chat-accent-text) outline-none transition-colors hover:bg-(--chat-accent) hover:text-(--chat-accent-ink) focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring) disabled:pointer-events-none disabled:opacity-50"
                    >
                        <CallBackIcon className="size-4" aria-hidden />
                        Call back
                    </button>
                )}
            </div>
        </div>
    );
}
