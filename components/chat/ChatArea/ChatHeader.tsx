import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ArrowLeftIcon, ImageIcon, InfoIcon, MoreVerticalIcon, PhoneIcon, SearchIcon, VideoIcon } from 'lucide-react'
import { useChat } from '../ChatProvider'
import { useCallActions, useCallSelector } from '../hooks/useCall';
import UserStatusDisplay from '../UserStatusDisplay';
import { useTypingStatus } from '../hooks/useTyping';
import { useRouter } from 'next/navigation'
import { cn } from 'cn'
import type { Ref } from 'react'
import { CHAT_SEARCH_PANEL_ID } from '../lib/chatSearch'

interface ChatHeaderProps {
    /** The in-chat search is open. */
    searchOpen?: boolean;
    /** Opens the search, or closes it when it is already open. */
    onToggleSearch?: () => void;
    /** Lets the owner hand focus back to the button when the search closes. */
    searchButtonRef?: Ref<HTMLButtonElement>;
}

const ChatHeader = ({ searchOpen = false, onToggleSearch, searchButtonRef }: ChatHeaderProps) => {
    const { receiver, receiverId, chatId } = useChat();
    const { back } = useRouter();
    // Real-time "Typing..." of the other user; shown instead of Online/Offline while it lasts.
    const isTyping = useTypingStatus(chatId, receiverId);
    const { startCall } = useCallActions();
    const inCall = useCallSelector((call) => call.phase !== 'idle');
    // `receiver` still holds the previous person for a moment after switching chats: only call who is on screen.
    const peer = receiverId && receiver?.id === receiverId ? { id: receiverId, name: receiver.name ?? 'User' } : null;
    const callButton = "size-9 text-muted-foreground hover:text-foreground rounded-xl transition-all disabled:pointer-events-none disabled:opacity-40";
    return (
        <div className="h-16 px-4 md:px-6 border-b border-border/40 flex items-center justify-between bg-card/20 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-3">
                {/* {onBack && ( */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                        back();
                    }}
                    className="md:hidden size-9 text-muted-foreground rounded-xl"
                >
                    <ArrowLeftIcon className="h-5 w-5" />
                </Button>
                {/* )} */}

                <div className="relative group cursor-pointer">
                    <Avatar className="h-10 w-10 ring-1 ring-border/50 shadow-sm">
                        <AvatarImage
                            src=""
                            alt="Alex Rivera"
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

                <div className="flex flex-col">
                    <span className="font-semibold text-sm tracking-tight text-foreground flex items-center gap-2">
                        {receiver?.name}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-0.5 md:gap-1">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger
                            type="button"
                            aria-label="Voice call"
                            disabled={!peer || inCall}
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
                            disabled={!peer || inCall}
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
                    <DropdownMenuTrigger className="size-9 text-muted-foreground hover:text-foreground rounded-xl transition-all">

                        <MoreVerticalIcon className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        className="w-48 rounded-xl space-y-2 p-2 backdrop-blur-lg border-border/50"
                    >
                        <DropdownMenuItem className="gap-2.5 text-xs font-medium cursor-pointer rounded-lg">
                            <InfoIcon className="size-3.5 text-muted-foreground" /> Contact Info
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2.5 text-xs font-medium cursor-pointer rounded-lg">
                            <ImageIcon className="size-3.5 text-muted-foreground" /> Shared Media
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border/40" />
                        <DropdownMenuItem className="gap-2.5 text-xs font-medium cursor-pointer rounded-lg text-destructive focus:text-destructive">
                            Delete Chat
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}

export default ChatHeader