import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ArrowLeftIcon, BanIcon, BroomSparkles, InfoIcon, Loader2Icon, MoreVerticalIcon, PhoneIcon, SearchIcon, Trash2Icon, UserCheckIcon, VideoIcon } from 'lucide-react'
import { useChat } from '../ChatProvider'
import { useCallActions, useCallSelector } from '../hooks/useCall';
import UserStatusDisplay, { TypingDots } from '../UserStatusDisplay';
import { useTypingStatus } from '../hooks/useTyping';
import { useUserPresence } from '../hooks/useUserPresence';
import { cn } from 'cn'
import { useEffect, useState, type Ref } from 'react'
import { CHAT_SEARCH_PANEL_ID } from '../lib/chatSearch'
import { formatLastSeen } from '../lib/presence'
import { ui } from '../lib/chatTheme'
import { ContactInfoSheet } from './ContactInfoSheet'
import { ConversationActionDialog, type ConfirmableAction } from './ConversationActionDialog'
import { usePushParams } from '../hooks/usePushParams'

interface ChatHeaderProps {
    /** The in-chat search is open. */
    searchOpen?: boolean;
    /** Opens the search, or closes it when it is already open. */
    onToggleSearch?: () => void;
    /** Lets the owner hand focus back to the button when the search closes. */
    searchButtonRef?: Ref<HTMLButtonElement>;
    /** There is something to clear: the chat has messages on screen. */
    canClear?: boolean;
    /**
     * When the newest message of the conversation was sent (ISO time). "Clear" and "Delete" stop exactly there, so a
     * message that arrives while the confirmation is open is not wiped without ever being seen.
     */
    newestMessageAt?: string | null;
}

const menuItem = "cursor-pointer gap-3 rounded-xl px-3 py-2.5 text-sm font-medium [&_svg]:size-[18px]";

const ChatHeader = ({ searchOpen = false, onToggleSearch, searchButtonRef, canClear = false, newestMessageAt = null }: ChatHeaderProps) => {
    const { receiver, receiverId, chatId, conversation, conversationActions } = useChat();
    const { busy, pending } = conversationActions;
    const blocked = conversation.blocked;
    // Real-time "typing" of the other user; shown instead of the presence line while it lasts.
    // Never while blocked: nothing they type is meant for this person.
    const isTyping = useTypingStatus(chatId, receiverId) && !blocked;
    const presence = useUserPresence(receiver?.id && receiver.id === receiverId ? receiver.id : null);
    const { startCall } = useCallActions();
    const inCall = useCallSelector((call) => call.phase !== 'idle');
    // `receiver` still holds the previous person for a moment after switching chats: only call who is on screen.
    const peer = receiverId && receiver?.id === receiverId ? { id: receiverId, name: receiver.name ?? 'User' } : null;

    const [confirming, setConfirming] = useState<ConfirmableAction | null>(null);
    const { pushQuery, clearQueryByKey } = usePushParams();
    const [infoOpen, setInfoOpen] = useState(false);

    // The panels belong to the chat they were opened in.
    useEffect(() => {
        setInfoOpen(false);
        setConfirming(null);
    }, [chatId]);

    /** Opens a confirmation. The contact sheet closes first: two modal layers at once fight over focus. */
    const askToConfirm = (action: ConfirmableAction) => {
        setInfoOpen(false);
        setConfirming(action);
    };

    const handleConfirm = async (action: ConfirmableAction) => {
        const ok =
            action === 'block'
                ? await conversationActions.block()
                : action === 'clear'
                    ? await conversationActions.clear(newestMessageAt)
                    : await conversationActions.remove(newestMessageAt);
        // A failure keeps the dialog open (the toast says why), so it can be retried or cancelled.
        if (ok) setConfirming(null);
    };

    const startCallFromSheet = (mode: 'audio' | 'video') => {
        if (!peer) return;
        setInfoOpen(false);
        startCall(peer, mode);
    };

    const statusLine = isTyping ? (
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-(--chat-accent-text)">
            typing <TypingDots />
        </span>
    ) : conversation.blockedByMe ? (
        <span className="flex items-center gap-1 text-[13px] font-medium text-(--chat-danger)">
            <BanIcon className="size-3.5" aria-hidden />
            Blocked
        </span>
    ) : presence.known ? (
        presence.online ? (
            <span className="text-[13px] font-medium text-(--chat-online)">Online</span>
        ) : presence.lastChanged ? (
            <span className="truncate text-[13px] text-(--chat-ink-3)">Last seen {formatLastSeen(presence.lastChanged)}</span>
        ) : (
            <span className="text-[13px] text-(--chat-ink-3)">Offline</span>
        )
    ) : null;

    return (
        <header className="relative z-10 flex h-[68px] shrink-0 items-center justify-between gap-2 border-b border-(--chat-line) bg-(--chat-surface) px-2 sm:px-4">
            <div className="flex min-w-0 flex-1 items-center gap-1">
                {/* Phones show one pane at a time: this is the way back to the list. */}
                <button
                    type="button"
                    onClick={() => clearQueryByKey('receiverId')}
                    aria-label="Back to conversations"
                    className={cn(ui.iconButton, 'md:hidden')}
                >
                    <ArrowLeftIcon />
                </button>

                {/* The person is the way into their contact info, like in every messenger. */}
                <button
                    type="button"
                    onClick={() => {
                        pushQuery('contactInfo', 'true')
                        setInfoOpen(true)
                    }}
                    disabled={!chatId}
                    aria-label={`View contact info${receiver?.name ? ` of ${receiver.name}` : ''}`}
                    className="group flex min-w-0 items-center gap-2.5 rounded-2xl py-1 pe-2 ps-1 text-start outline-none sm:gap-3 sm:pe-3 transition-colors hover:bg-(--chat-surface-2) focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring)"
                >
                    <div className="relative shrink-0">
                        <Avatar className="size-10 bg-(--chat-accent-soft) ring-1 ring-(--chat-line) sm:size-11">
                            <AvatarImage src={receiver?.imageUrl || undefined} alt={receiver?.name ?? 'Contact'} className="object-cover" />
                            <AvatarFallback className="bg-(--chat-accent-soft) text-base font-semibold text-(--chat-accent-text)">
                                {receiver?.name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        {receiver?.id && (
                            <span className="absolute -bottom-0.5 -end-0.5">
                                <UserStatusDisplay userId={receiver.id} ping />
                            </span>
                        )}
                    </div>

                    <div className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate text-base font-semibold text-(--chat-ink)">{receiver?.name}</span>
                        <span className="mt-0.5 min-h-[18px]">{statusLine}</span>
                    </div>
                </button>
            </div>

            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger
                            type="button"
                            aria-label="Voice call"
                            disabled={!peer || inCall || blocked}
                            onClick={() => peer && startCall(peer, 'audio')}
                            className={cn(ui.iconButton, 'max-sm:hidden')}
                        >
                            <PhoneIcon strokeWidth={1.75} />
                        </TooltipTrigger>
                        <TooltipContent>Voice call</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger
                            type="button"
                            aria-label="Video call"
                            disabled={!peer || inCall || blocked}
                            onClick={() => peer && startCall(peer, 'video')}
                            className={ui.iconButton}
                        >
                            <VideoIcon strokeWidth={1.75} />
                        </TooltipTrigger>
                        <TooltipContent>Video call</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger
                            ref={searchButtonRef}
                            type="button"
                            aria-label={searchOpen ? "Close search" : "Search in chat"}
                            aria-expanded={searchOpen}
                            aria-controls={searchOpen ? CHAT_SEARCH_PANEL_ID : undefined}
                            aria-pressed={searchOpen}
                            disabled={!chatId || !onToggleSearch}
                            onClick={onToggleSearch}
                            className={ui.iconButton}
                        >
                            <SearchIcon strokeWidth={1.75} />
                        </TooltipTrigger>
                        <TooltipContent>{searchOpen ? "Close search" : "Search in chat"}</TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <DropdownMenu>
                    <DropdownMenuTrigger
                        aria-label="Chat options"
                        aria-busy={busy}
                        disabled={!chatId}
                        className={cn(ui.iconButton, 'data-popup-open:bg-(--chat-surface-3) data-popup-open:text-(--chat-ink)')}
                    >
                        {busy ? <Loader2Icon className="animate-spin" /> : <MoreVerticalIcon strokeWidth={1.75} />}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className={cn(ui.layer, 'w-56 rounded-2xl p-1.5')}>
                        <DropdownMenuItem
                            className={menuItem}
                            onClick={() => {
                                setInfoOpen(true);
                                pushQuery('contactInfo', 'true')
                            }}
                        >
                            <InfoIcon className="text-(--chat-ink-3)" /> Contact info
                        </DropdownMenuItem>
                        {/* Narrow screens have no room for a second call button in the bar. */}
                        <DropdownMenuItem
                            className={cn(menuItem, 'sm:hidden')}
                            disabled={!peer || inCall || blocked}
                            onClick={() => peer && startCall(peer, 'audio')}
                        >
                            <PhoneIcon className="text-(--chat-ink-3)" /> Voice call
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-(--chat-line)" />
                        {conversation.blockedByMe ? (
                            <DropdownMenuItem className={menuItem} disabled={busy} onClick={() => void conversationActions.unblock()}>
                                <UserCheckIcon className="text-(--chat-ink-3)" /> Unblock
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem className={menuItem} disabled={busy || !peer} onClick={() => askToConfirm('block')}>
                                <BanIcon className="text-(--chat-ink-3)" /> Block
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className={menuItem} disabled={busy || !canClear} onClick={() => askToConfirm('clear')}>
                            <BroomSparkles className="text-(--chat-ink-3)" /> Clear chat
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-(--chat-line)" />
                        <DropdownMenuItem variant="destructive" className={menuItem} disabled={busy} onClick={() => askToConfirm('delete')}>
                            <Trash2Icon /> Delete chat
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {infoOpen &&
                <ContactInfoSheet
                    open={infoOpen}
                    onOpenChange={() => {
                        setInfoOpen(false)
                        clearQueryByKey('contactInfo')
                    }}
                    isTyping={isTyping}
                    canClear={canClear}
                    callDisabled={inCall || blocked}
                    onCall={startCallFromSheet}
                    onSearch={onToggleSearch && !searchOpen ? () => { setInfoOpen(false); onToggleSearch(); } : undefined}
                    onConfirmAction={askToConfirm}
                    onUnblock={() => void conversationActions.unblock()}
                />}

            <ConversationActionDialog
                action={confirming}
                name={receiver?.name}
                pending={confirming !== null && pending === confirming}
                onConfirm={(action) => void handleConfirm(action)}
                onClose={() => setConfirming(null)}
            />
        </header>
    )
}

export default ChatHeader
