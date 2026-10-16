"use client";

import { useCallback, useMemo, type RefObject } from "react";
import { ArrowDownIcon, ChevronDownIcon, ChevronUpIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { cn } from "cn";
import { CallLogMessage } from "../Call/CallLogMessage";
import { useToday } from "../hooks/useToday";
import type { CallPeer } from "../lib/call";
import { groupByDay } from "../lib/dateSeparators";
import { colorIndexOf, firstNameOf, type GroupInfo } from "../lib/groups";
import { ui } from "../lib/chatTheme";
import type { ReactionKey } from "../lib/reactions";
import type { MessageType } from "../types";
import { DateSeparator } from "./DateSeparator";
import { MessageItem } from "./Message/MessageItem";

interface MessageListProps {
    messages: readonly MessageType[];
    loading: boolean;
    failed: boolean;
    hasOlder: boolean;
    hasNewer: boolean;
    loadingOlder: boolean;
    loadingNewer: boolean;
    detached: boolean;
    onLoadOlder: () => void;
    onLoadNewer: () => void;
    onReload: () => void;

    // From useChatScroll.
    scrollerRef: RefObject<HTMLDivElement | null>;
    contentRef: RefObject<HTMLDivElement | null>;
    topSentinelRef: RefObject<HTMLDivElement | null>;
    bottomSentinelRef: RefObject<HTMLDivElement | null>;
    jumping: boolean;
    flashId: string | null;
    showLatest: boolean;
    onGoToLatest: () => void;

    currentUserId: string;
    otherUserName?: string;
    /** The open group, when this is a group conversation: names go above other people's messages. */
    group?: GroupInfo | null;
    peer: CallPeer | null;
    blocked: boolean;
    editingId: string | null;
    isPending: (messageId: string) => boolean;
    onReact: (messageId: string, reaction: ReactionKey | null) => void;
    onStartEdit: (messageId: string) => void;
    onCancelEdit: () => void;
    onSaveEdit: (messageId: string, text: string) => void;
    onRequestDelete: (message: MessageType) => void;
    highlightTerms: readonly string[];
}

/** Bubble-shaped placeholders: the shape of a conversation while the real one loads. */
const SKELETON_ROWS: ReadonlyArray<{ mine: boolean; width: string; height: string }> = [
    { mine: false, width: "w-[55%]", height: "h-12" },
    { mine: false, width: "w-[36%]", height: "h-9" },
    { mine: true, width: "w-[48%]", height: "h-10" },
    { mine: false, width: "w-[62%]", height: "h-16" },
    { mine: true, width: "w-[32%]", height: "h-9" },
    { mine: true, width: "w-[52%]", height: "h-12" },
    { mine: false, width: "w-[42%]", height: "h-10" },
];

function LoadingSkeleton() {
    return (
        <div className="flex flex-col gap-2.5 px-1 py-6" role="status" aria-label="Loading messages">
            {SKELETON_ROWS.map((row, index) => (
                <div key={index} className={cn("flex", row.mine ? "justify-end" : "justify-start")}>
                    <div
                        className={cn(
                            "rounded-[18px]",
                            row.mine ? "chat-skeleton-out rounded-br-[6px]" : "chat-skeleton-in rounded-bl-[6px]",
                            row.width,
                            row.height
                        )}
                    />
                </div>
            ))}
        </div>
    );
}

/** "You created this group" / "Sara created this group", with the day when it is known. */
function describeCreation(group: GroupInfo, currentUserId: string): string {
    const creator = group.members.find((member) => member.id === group.createdBy);
    const who = group.createdBy === currentUserId ? "You" : creator ? firstNameOf(creator.name) || creator.name : "Someone";
    const when = group.createdAt?.toLocaleDateString(undefined, { dateStyle: "medium" });
    return when ? `${who} created this group · ${when}` : `${who} created this group`;
}

function EmptyConversation({ blocked, name, group, currentUserId }: { blocked: boolean; name?: string; group?: GroupInfo | null; currentUserId: string }) {
    return (
        <div className="my-auto flex flex-col items-center px-6 py-16 text-center">
            <svg viewBox="0 0 120 96" className="mb-5 h-24 w-[7.5rem]" aria-hidden>
                <rect x="6" y="10" width="68" height="44" rx="16" className="fill-(--chat-in) stroke-(--chat-line-strong)" strokeWidth="1.5" />
                <path d="M22 54 L16 68 L36 54 Z" className="fill-(--chat-in) stroke-(--chat-line-strong)" strokeWidth="1.5" strokeLinejoin="round" />
                <rect x="20" y="25" width="40" height="5" rx="2.5" className="fill-(--chat-line-strong)" />
                <rect x="20" y="36" width="26" height="5" rx="2.5" className="fill-(--chat-line)" />
                <rect x="46" y="38" width="68" height="44" rx="16" className="fill-(--chat-out)" />
                <path d="M100 82 L108 92 L84 82 Z" className="fill-(--chat-out)" strokeLinejoin="round" />
                <rect x="60" y="53" width="40" height="5" rx="2.5" fill="white" opacity="0.85" />
                <rect x="60" y="64" width="24" height="5" rx="2.5" fill="white" opacity="0.5" />
            </svg>
            <p className="text-base font-semibold text-(--chat-ink)">{blocked ? "Messages are unavailable" : "No messages yet"}</p>
            <p className="mt-1 max-w-64 text-sm text-(--chat-ink-2)">
                {blocked
                    ? "Messages and calls are unavailable in this conversation."
                    : group
                      ? `Say hello to everyone in ${group.name} to get the conversation going.`
                      : name
                        ? `Say hello to ${name} to start the conversation.`
                        : "Send a message to start the conversation."}
            </p>
            {group && <p className="mt-4 rounded-full bg-(--chat-surface-3) px-3 py-1 text-xs text-(--chat-ink-2)">{describeCreation(group, currentUserId)}</p>}
        </div>
    );
}

function LoadRow({
    direction,
    loading,
    onClick,
}: {
    direction: "older" | "newer";
    loading: boolean;
    onClick: () => void;
}) {
    const Icon = direction === "older" ? ChevronUpIcon : ChevronDownIcon;
    return (
        <div className="flex justify-center py-3">
            <button
                type="button"
                onClick={onClick}
                disabled={loading}
                aria-busy={loading}
                className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full border border-(--chat-line) bg-(--chat-surface) px-4 text-[13px] font-medium text-(--chat-ink-2) shadow-(--chat-shadow-sm) outline-none transition-colors hover:bg-(--chat-surface-3) hover:text-(--chat-ink) disabled:pointer-events-none",
                    ui.focus
                )}
            >
                {loading ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : <Icon className="size-4" aria-hidden />}
                {loading ? "Loading..." : direction === "older" ? "Show earlier messages" : "Show newer messages"}
            </button>
        </div>
    );
}

export function MessageList({
    messages,
    loading,
    failed,
    hasOlder,
    hasNewer,
    loadingOlder,
    loadingNewer,
    detached,
    onLoadOlder,
    onLoadNewer,
    onReload,
    scrollerRef,
    contentRef,
    topSentinelRef,
    bottomSentinelRef,
    jumping,
    flashId,
    showLatest,
    onGoToLatest,
    currentUserId,
    otherUserName,
    group = null,
    peer,
    blocked,
    editingId,
    isPending,
    onReact,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onRequestDelete,
    highlightTerms,
}: MessageListProps) {
    // The current day, so "Today" turns into "Yesterday" by itself if the chat stays open past midnight.
    const today = useToday();
    const sections = useMemo(() => groupByDay(messages, today), [messages, today]);
    const empty = !loading && !failed && messages.length === 0;

    // In a group, whoever wrote a message is named from the group's own member list.
    const members = useMemo(() => (group ? new Map(group.members.map((member) => [member.id, member.name])) : null), [group]);
    const nameOfUser = useCallback((userId: string) => members?.get(userId), [members]);

    return (
        <div className="relative flex min-h-0 flex-1 flex-col">
            <div ref={scrollerRef} className="chat-scroll min-h-0 flex-1 overflow-y-auto px-2 sm:px-5 lg:px-8">
                <div ref={contentRef} className="mx-auto flex min-h-full w-full max-w-3xl flex-col pb-4 pt-1">
                    <div ref={topSentinelRef} aria-hidden className="h-px" />

                    {loading ? (
                        <LoadingSkeleton />
                    ) : failed ? (
                        <div className="my-auto flex flex-col items-center px-6 py-20 text-center">
                            <p className="text-base font-semibold text-(--chat-ink)">Couldn&apos;t open this conversation</p>
                            <p className="mt-1 text-sm text-(--chat-ink-2)">Check your connection and try again.</p>
                            <button type="button" onClick={onReload} className={cn(ui.primaryButton, "mt-4")}>
                                <RefreshCwIcon className="size-4" aria-hidden />
                                Try again
                            </button>
                        </div>
                    ) : empty ? (
                        <EmptyConversation blocked={blocked} name={otherUserName} group={group} currentUserId={currentUserId} />
                    ) : (
                        <>
                            {hasOlder ? (
                                <LoadRow direction="older" loading={loadingOlder} onClick={onLoadOlder} />
                            ) : (
                                <p className="py-4 text-center text-xs text-(--chat-ink-3)">
                                    {group ? describeCreation(group, currentUserId) : "Beginning of the conversation"}
                                </p>
                            )}

                            {sections.map((section) => (
                                <section key={section.key} aria-label={section.title || undefined} className="relative flex flex-col">
                                    <DateSeparator label={section.label} title={section.title} dateTime={section.dateTime} />
                                    {section.rows.map(({ message, joinsPrevious }) =>
                                        message.call ? (
                                            <CallLogMessage key={message.id} message={message} peer={peer} />
                                        ) : (
                                            <MessageItem
                                                key={message.id}
                                                message={message}
                                                currentUserId={currentUserId}
                                                otherUserName={otherUserName}
                                                senderName={members ? (members.get(message.senderId) ?? "Former member") : undefined}
                                                senderTone={members ? colorIndexOf(message.senderId, 8) : undefined}
                                                nameOfUser={members ? nameOfUser : undefined}
                                                joinsPrevious={joinsPrevious}
                                                isEditing={editingId === message.id && !message.deleted}
                                                isPending={isPending(message.id)}
                                                onReact={onReact}
                                                onStartEdit={onStartEdit}
                                                onCancelEdit={onCancelEdit}
                                                onSaveEdit={onSaveEdit}
                                                onRequestDelete={onRequestDelete}
                                                highlightTerms={highlightTerms}
                                                isFlashing={flashId === message.id}
                                            />
                                        )
                                    )}
                                </section>
                            ))}

                            {detached && hasNewer && <LoadRow direction="newer" loading={loadingNewer} onClick={onLoadNewer} />}
                        </>
                    )}

                    <div ref={bottomSentinelRef} aria-hidden className="h-px" />
                </div>
            </div>

            {jumping && (
                <div role="status" className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center">
                    <span className="chat-rise flex items-center gap-2 rounded-full border border-(--chat-line) bg-(--chat-surface) px-4 py-2 text-[13px] font-medium text-(--chat-ink-2) shadow-(--chat-shadow-md)">
                        <Loader2Icon className="size-4 animate-spin text-(--chat-accent-text)" aria-hidden />
                        Finding message...
                    </span>
                </div>
            )}

            {showLatest && !loading && (
                <button
                    type="button"
                    onClick={onGoToLatest}
                    aria-label="Go to the latest messages"
                    title="Go to the latest messages"
                    className={cn(
                        "chat-rise absolute bottom-4 end-4 z-20 inline-flex items-center justify-center rounded-full shadow-(--chat-shadow-md) outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring) sm:end-6",
                        detached
                            ? "h-11 gap-2 bg-(--chat-accent) px-4 text-sm font-medium text-(--chat-accent-ink) hover:bg-(--chat-accent-hover)"
                            : "size-11 border border-(--chat-line) bg-(--chat-surface) text-(--chat-ink-2) hover:bg-(--chat-surface-3) hover:text-(--chat-ink)"
                    )}
                >
                    <ArrowDownIcon className="size-5" aria-hidden />
                    {detached && "Latest"}
                </button>
            )}
        </div>
    );
}
