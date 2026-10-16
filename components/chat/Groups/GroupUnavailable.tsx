"use client";

import { ArrowLeftIcon, UsersIcon } from "lucide-react";
import { cn } from "cn";
import { usePushParams } from "../hooks/usePushParams";
import { ui } from "../lib/chatTheme";

/**
 * What the conversation pane shows when the group in the address isn't one the signed-in user can open: it doesn't
 * exist, or they aren't in it. The two look the same on purpose, so the page doesn't reveal which groups exist.
 */
export function GroupUnavailable() {
    const { clearQueryByKey } = usePushParams();

    return (
        <div role="alert" className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 py-16 text-center">
            <span className="mb-4 grid size-14 place-items-center rounded-full bg-(--chat-accent-soft) text-(--chat-accent-text)">
                <UsersIcon className="size-6" aria-hidden="true" />
            </span>
            <p className="text-base font-semibold text-(--chat-ink)">This group isn&apos;t available</p>
            <p className="mt-1 max-w-72 text-sm text-(--chat-ink-2)">It may have been removed, or you may not be a member of it.</p>
            <button type="button" onClick={() => clearQueryByKey("groupId")} className={cn(ui.primaryButton, "mt-5")}>
                <ArrowLeftIcon className="size-4 rtl:rotate-180" aria-hidden="true" />
                Back to conversations
            </button>
        </div>
    );
}
