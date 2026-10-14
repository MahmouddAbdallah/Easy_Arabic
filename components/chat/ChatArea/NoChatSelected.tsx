import { MessageCircleIcon } from "lucide-react";

/** The pane beside the conversation list while no conversation is open. */
export default function NoChatSelected() {
    return (
        <div className="relative flex h-full flex-1 flex-col items-center justify-center overflow-hidden bg-(--chat-canvas) p-8 text-center">
            <div className="relative flex max-w-sm flex-col items-center">
                <svg viewBox="0 0 160 120" className="mb-7 h-32 w-44" aria-hidden>
                    <rect x="10" y="14" width="92" height="58" rx="22" className="fill-(--chat-in) stroke-(--chat-line-strong)" strokeWidth="1.5" />
                    <path d="M32 72 L22 92 L50 72 Z" className="fill-(--chat-in) stroke-(--chat-line-strong)" strokeWidth="1.5" strokeLinejoin="round" />
                    <rect x="28" y="33" width="54" height="6" rx="3" className="fill-(--chat-line-strong)" />
                    <rect x="28" y="47" width="34" height="6" rx="3" className="fill-(--chat-line)" />
                    <rect x="62" y="50" width="88" height="58" rx="22" className="fill-(--chat-out)" />
                    <path d="M126 108 L138 120 L104 108 Z" className="fill-(--chat-out)" strokeLinejoin="round" />
                    <rect x="80" y="69" width="52" height="6" rx="3" fill="white" opacity="0.85" />
                    <rect x="80" y="83" width="32" height="6" rx="3" fill="white" opacity="0.5" />
                </svg>

                <h2 className="text-xl font-semibold text-(--chat-ink)">Your messages</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-(--chat-ink-2)">
                    Pick a conversation from the list, or search for a person to start a new one.
                </p>
                <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-(--chat-accent-soft) px-4 py-2 text-sm font-medium text-(--chat-accent-text)">
                    <MessageCircleIcon className="size-4" aria-hidden />
                    Nothing selected yet
                </span>
            </div>
        </div>
    );
}
