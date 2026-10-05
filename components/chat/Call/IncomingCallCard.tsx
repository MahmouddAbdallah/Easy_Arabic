"use client";

import { PhoneIcon, PhoneOffIcon, VideoIcon } from "lucide-react";
import type { CallActions } from "../hooks/useCall";
import type { CallSessionState } from "../lib/callController";
import { CallAvatar } from "./CallAvatar";
import { ControlButton } from "./ControlButton";

interface IncomingCallCardProps {
    call: CallSessionState;
    actions: Pick<CallActions, "acceptCall" | "declineCall">;
}

/**
 * Somebody is calling. On a phone it takes the whole screen, like the phone's own incoming-call screen;
 * on a larger screen it is a card in the corner that leaves the rest of the app usable.
 */
export function IncomingCallCard({ call, actions }: IncomingCallCardProps) {
    const isVideo = call.mode === "video";
    const name = call.peer?.name ?? "Someone";
    const KindIcon = isVideo ? VideoIcon : PhoneIcon;

    return (
        <div
            role="alertdialog"
            aria-labelledby="incoming-call-title"
            aria-describedby="incoming-call-status"
            className="fixed inset-0 z-110 flex flex-col items-center justify-between bg-linear-to-b from-zinc-900 via-zinc-950 to-black px-6 pt-[max(5rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))] text-white md:inset-auto md:top-6 md:right-6 md:w-80 md:justify-start md:gap-6 md:rounded-3xl md:border md:border-white/10 md:bg-zinc-900/95 md:px-6 md:py-7 md:shadow-2xl md:backdrop-blur-xl"
        >
            <div className="flex flex-col items-center gap-6 text-center md:gap-3">
                <CallAvatar name={name} size="xl" ringing className="md:size-20 md:text-3xl" />
                <div className="space-y-1.5">
                    <h2 id="incoming-call-title" className="max-w-[18rem] truncate text-3xl font-semibold md:text-lg">
                        {name}
                    </h2>
                    <p id="incoming-call-status" className="flex items-center justify-center gap-1.5 text-base text-white/70 md:text-sm">
                        <KindIcon className="size-4" aria-hidden />
                        Incoming {isVideo ? "video" : "voice"} call…
                    </p>
                </div>
                {call.notice && (
                    <p role="alert" className="max-w-xs rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">
                        {call.notice}
                    </p>
                )}
            </div>

            <div className="flex w-full items-start justify-center gap-16 md:gap-10">
                <ControlButton label="Decline" variant="danger" size="lg" onClick={actions.declineCall}>
                    <PhoneOffIcon />
                </ControlButton>
                <ControlButton label="Accept" variant="accept" size="lg" onClick={actions.acceptCall}>
                    <KindIcon />
                </ControlButton>
            </div>
        </div>
    );
}
