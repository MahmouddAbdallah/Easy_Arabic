"use client";

import { BanIcon, Loader2Icon, UserCheckIcon } from "lucide-react";
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
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[22px] border border-(--chat-danger)/25 bg-(--chat-danger-soft) px-4 py-3"
            >
                <p className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-(--chat-danger)">
                    <BanIcon className="size-4 shrink-0" aria-hidden />
                    <span>You blocked {name || "this contact"}. Unblock to send messages or call.</span>
                </p>
                <button
                    type="button"
                    disabled={busy}
                    aria-busy={pending === "unblock"}
                    onClick={() => void conversationActions.unblock()}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-(--chat-line-strong) bg-(--chat-surface) px-4 text-sm font-medium text-(--chat-ink) outline-none transition-colors hover:bg-(--chat-surface-3) focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring) disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4"
                >
                    {pending === "unblock" ? <Loader2Icon className="animate-spin" /> : <UserCheckIcon />}
                    Unblock
                </button>
            </div>
        );
    }

    return (
        <p
            role="status"
            className="flex items-center justify-center gap-2.5 rounded-[22px] border border-(--chat-line) bg-(--chat-surface) px-4 py-3 text-sm font-medium text-(--chat-ink-2)"
        >
            <BanIcon className="size-4 shrink-0" aria-hidden />
            You can&apos;t send messages or call this person right now.
        </p>
    );
}
