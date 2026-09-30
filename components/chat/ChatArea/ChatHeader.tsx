import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ArrowLeftIcon, ImageIcon, InfoIcon, MoreVerticalIcon, PhoneIcon, SearchIcon, VideoIcon } from 'lucide-react'
import { useChat } from '../ChatProvider'
import UserStatusDisplay from '../UserStatusDisplay';
import { useTypingStatus } from '../hooks/useTyping';
import { useRouter } from 'next/navigation'

const ChatHeader = () => {
    const { receiver, receiverId, chatId } = useChat();
    const { back } = useRouter();
    // Real-time "Typing..." of the other user; shown instead of Online/Offline while it lasts.
    const isTyping = useTypingStatus(chatId, receiverId);
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
                    className="md:hidden h-9 w-9 text-muted-foreground rounded-xl"
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
                        <TooltipTrigger >
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-xl transition-all"
                            >
                                <PhoneIcon className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Voice Call</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger >
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-xl transition-all"
                            >
                                <VideoIcon className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Video Call</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger >
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-xl transition-all"
                            >
                                <SearchIcon className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Search in Chat</TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <DropdownMenu>
                    <DropdownMenuTrigger >
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-xl transition-all"
                        >
                            <MoreVerticalIcon className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        className="w-48 rounded-xl backdrop-blur-lg border-border/50"
                    >
                        <DropdownMenuItem className="gap-2.5 text-xs font-medium cursor-pointer rounded-lg">
                            <InfoIcon className="h-3.5 w-3.5 text-muted-foreground" /> Contact Info
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2.5 text-xs font-medium cursor-pointer rounded-lg">
                            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /> Shared Media
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