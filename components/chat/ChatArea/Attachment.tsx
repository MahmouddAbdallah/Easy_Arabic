import { FileTextIcon } from 'lucide-react'
import React from 'react'
export interface AttachmentItem {
    attachment: {
        type: "image" | "file";
        url?: string;
        fileName?: string;
        fileSize?: string;
    }
    isMe: boolean
}
const Attachment: React.FC<AttachmentItem> = ({ attachment, isMe }) => {
    return (
        <div
            className={`flex items-center gap-3 p-2.5 rounded-xl mb-2.5 border transition-colors ${isMe
                ? "bg-black/10 border-white/15"
                : "bg-background/40 border-border/30 hover:bg-background/60"
                }`}
        >
            <div
                className={`p-2 rounded-lg flex items-center justify-center shrink-0 ${isMe
                    ? "bg-white/15 text-primary-foreground"
                    : "bg-primary/10 text-primary"
                    }`}
            >
                <FileTextIcon className="h-4 w-4" />
            </div>
            <div className="flex flex-col min-w-0 pr-1">
                <span className="font-medium truncate text-[11px] leading-tight">
                    {attachment?.fileName}
                </span>
                <span
                    className={`text-[9px] mt-0.5 ${isMe ? "opacity-80" : "text-muted-foreground"
                        }`}
                >
                    {attachment?.fileSize}
                </span>
            </div>
        </div>
    )
}

export default Attachment