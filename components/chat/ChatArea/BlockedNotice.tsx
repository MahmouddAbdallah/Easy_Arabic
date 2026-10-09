"use client";

import { BanIcon, Loader2Icon, UserCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "../ChatProvider";

/**
 * Takes the place of the message composer while the conversation is blocked (by either person).
 * Whoever blocked gets the way out right here; the other person only learns that sending is unavailable.
 */
export function BlockedNotice() {
    const { receiver, receiverId, conversation, conversationActions } = useChat();
    const { busy, pending } = conversationActions;
    // `receiver` still holds the previous person for a moment after switching chats.
    const name = receiverId && receiver?.id === receiverId ? receiver.name : undefined;

    if (conversation.blockedByMe) {
        return (
            <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3"
            >
                <p className="flex min-w-0 items-center gap-2.5 text-xs font-medium text-destructive">
                    <BanIcon className="size-4 shrink-0" aria-hidden />
                    <span>You blocked {name || "this contact"}. Unblock to send messages or call.</span>
                </p>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    aria-busy={pending === "unblock"}
                    onClick={() => void conversationActions.unblock()}
                    className="rounded-xl"
                >
                    {pending === "unblock" ? <Loader2Icon className="animate-spin" /> : <UserCheckIcon />}
                    Unblock
                </Button>
            </div>
        );
    }

    return (
        <p
            role="status"
            className="flex items-center justify-center gap-2.5 rounded-2xl border border-border/50 bg-muted/40 px-4 py-3 text-xs font-medium text-muted-foreground"
        >
            <BanIcon className="size-4 shrink-0" aria-hidden />
            You can&apos;t send messages or call this person right now.
        </p>
    );
}
