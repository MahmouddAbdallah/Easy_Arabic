import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { BanIcon, BroomSparkles, InfoIcon, Loader2Icon, MoreVerticalIcon, PhoneIcon, SearchIcon, Trash2Icon, UserCheckIcon, VideoIcon } from 'lucide-react'
import { useChat } from '../ChatProvider'
import { useCallActions, useCallSelector } from '../hooks/useCall';
import UserStatusDisplay from '../UserStatusDisplay';
import { useTypingStatus } from '../hooks/useTyping';
import { cn } from 'cn'
import { useEffect, useState, type Ref } from 'react'
import { CHAT_SEARCH_PANEL_ID } from '../lib/chatSearch'
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
     * When the newest message on screen was sent (ISO time). "Clear" and "Delete" stop exactly there, so a message
     * that arrives while the confirmation is open is not wiped without ever being seen.
     */
    newestMessageAt?: string | null;
}

const ChatHeader = ({ searchOpen = false, onToggleSearch, searchButtonRef, canClear = false, newestMessageAt = null }: ChatHeaderProps) => {
    const { receiver, receiverId, chatId, conversation, conversationActions } = useChat();
    const { busy, pending } = conversationActions;
    const blocked = conversation.blocked;
    // Real-time "Typing..." of the other user; shown instead of Online/Offline while it lasts.
    // Never while blocked: nothing they type is meant for this person.
    const isTyping = useTypingStatus(chatId, receiverId) && !blocked;
    const { startCall } = useCallActions();
    const inCall = useCallSelector((call) => call.phase !== 'idle');
    // `receiver` still holds the previous person for a moment after switching chats: only call who is on screen.
    const peer = receiverId && receiver?.id === receiverId ? { id: receiverId, name: receiver.name ?? 'User' } : null;
    const callButton = "md:mx-2 p-2 text-muted-foreground hover:text-foreground rounded-xl transition-all disabled:pointer-events-none disabled:opacity-40";

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

    const menuItem = "gap-2.5 text-xs font-medium cursor-pointer rounded-lg";

    return (
        <div className="h-16 px-4 md:px-6 border-b border-border/40 flex items-center justify-between bg-card/20 backdrop-blur-md shrink-0">
            <div className="flex min-w-0 items-center gap-3">
                {/* The person is the way into their contact info, like in every messenger. */}
                <button
                    type="button"
                    onClick={() => {
                        pushQuery('contactInfo', 'true')
                        setInfoOpen(true)
                    }}
                    disabled={!chatId}
                    aria-label={`View contact info${receiver?.name ? ` of ${receiver.name}` : ''}`}
                    className="group flex min-w-0 items-center gap-3 rounded-xl text-start outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                    <div className="relative shrink-0">
                        <Avatar className="h-10 w-10 ring-1 ring-border/50 shadow-sm">
                            <AvatarImage
                                src={receiver?.imageUrl || undefined}
                                alt={receiver?.name ?? 'Contact'}
                                className="object-cover"
                            />
                            <AvatarFallback className="font-semibold text-xs">
                                {receiver?.name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5" >
                            <UserStatusDisplay
                                userId={receiver?.id as string}
                                ping={true}
                                showStatus={true}
                                typing={isTyping}
                            />
                        </span>
                    </div>

                    <div className="flex min-w-0 flex-col">
                        <span className="truncate font-semibold text-sm tracking-tight text-foreground flex items-center gap-2">
                            {receiver?.name}
                        </span>
                        {conversation.blockedByMe && (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-destructive">
                                <BanIcon className="size-3" aria-hidden />
                                Blocked
                            </span>
                        )}
                    </div>
                </button>
            </div>

            <div className="flex items-center gap-0.5 md:gap-1">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger
                            type="button"
                            aria-label="Voice call"
                            disabled={!peer || inCall || blocked}
                            onClick={() => peer && startCall(peer, 'audio')}
                            className={callButton}
                        >

                            <PhoneIcon className="size-4" />
                        </TooltipTrigger>
                        <TooltipContent>Voice Call</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger
                            type="button"
                            aria-label="Video call"
                            disabled={!peer || inCall || blocked}
                            onClick={() => peer && startCall(peer, 'video')}
                            className={callButton}
                        >
                            <VideoIcon className="size-4" />
                        </TooltipTrigger>
                        <TooltipContent>Video Call</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger
                            ref={searchButtonRef}
                            type="button"
                            aria-label={searchOpen ? "Close search" : "Search in chat"}
                            aria-expanded={searchOpen}
                            aria-controls={searchOpen ? CHAT_SEARCH_PANEL_ID : undefined}
                            disabled={!chatId || !onToggleSearch}
                            onClick={onToggleSearch}
                            className={cn(
                                callButton,
                                searchOpen && "bg-muted text-foreground"
                            )}
                        >
                            <SearchIcon className="size-4" />
                        </TooltipTrigger>
                        <TooltipContent>{searchOpen ? "Close search" : "Search in Chat"}</TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <DropdownMenu>
                    <DropdownMenuTrigger
                        aria-label="Chat options"
                        aria-busy={busy}
                        disabled={!chatId}
                        className="grid p-2 place-items-center rounded-xl text-muted-foreground outline-none transition-all hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 data-popup-open:bg-muted data-popup-open:text-foreground disabled:pointer-events-none disabled:opacity-40"
                    >
                        {busy ? <Loader2Icon className="size-4 animate-spin" /> : <MoreVerticalIcon className="size-4" />}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        className="w-48 rounded-xl space-y-2 p-2 backdrop-blur-lg border-border/50"
                    >
                        <DropdownMenuItem
                            className={menuItem}
                            onClick={() => {
                                setInfoOpen(true);
                                pushQuery('contactInfo', 'true')
                            }}
                        >
                            <InfoIcon className="size-3.5 text-muted-foreground" /> Contact Info
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border/40" />
                        {conversation.blockedByMe ? (
                            <DropdownMenuItem
                                className={menuItem}
                                disabled={busy}
                                onClick={() => void conversationActions.unblock()}
                            >
                                <UserCheckIcon className="size-3.5 text-muted-foreground" /> Unblock
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem
                                className={menuItem}
                                disabled={busy || !peer}
                                onClick={() => askToConfirm('block')}
                            >
                                <BanIcon className="size-3.5 text-muted-foreground" /> Block
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                            className={menuItem}
                            disabled={busy || !canClear}
                            onClick={() => askToConfirm('clear')}
                        >
                            <BroomSparkles className="size-3.5 text-muted-foreground" /> Clear Chat
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border/40" />
                        <DropdownMenuItem
                            variant="destructive"
                            className={menuItem}
                            disabled={busy}
                            onClick={() => askToConfirm('delete')}
                        >
                            <Trash2Icon className="size-3.5" /> Delete Chat
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
        </div>
    )
}

export default ChatHeader
