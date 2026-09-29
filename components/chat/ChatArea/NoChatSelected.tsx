import { MessageSquarePlus, Sparkles, ShieldCheck, Zap } from "lucide-react";

export default function NoChatSelected() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center h-full bg-background/30 backdrop-blur-3xl relative select-none p-6 text-center overflow-hidden">
            {/* Background Subtle Glowing Gradient */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="size-75 bg-primary/10 rounded-full blur-3xl animate-pulse" />
            </div>

            <div className="relative z-10 max-w-md flex flex-col items-center space-y-6">
                {/* Main Animated Icon Badge */}
                <div className="relative">
                    <div className="w-20 h-20 rounded-3xl bg-linear-to-tr from-primary/20 via-primary/10 to-transparent border border-primary/20 flex items-center justify-center backdrop-blur-xl shadow-xl shadow-primary/5">
                        <MessageSquarePlus className="w-9 h-9 text-primary" />
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-primary"></span>
                    </span>
                </div>

                {/* Text Area */}
                <div className="space-y-2">
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">
                        No Conversation Selected
                    </h2>
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                        Choose a contact from the sidebar or start a new conversation to start messaging.
                    </p>
                </div>

                {/* Feature Highlights / Badges */}
                <div className="grid grid-cols-3 gap-3 w-full pt-4 border-t border-border/30">
                    <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-muted/30 border border-border/20 backdrop-blur-sm">
                        <Zap className="w-4 h-4 text-primary" />
                        <span className="text-[10px] font-medium text-muted-foreground">Fast Sync</span>
                    </div>

                    <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-muted/30 border border-border/20 backdrop-blur-sm">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        <span className="text-[10px] font-medium text-muted-foreground">Encrypted</span>
                    </div>

                    <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-muted/30 border border-border/20 backdrop-blur-sm">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-[10px] font-medium text-muted-foreground">Smart Features</span>
                    </div>
                </div>
            </div>
        </div>
    );
}