'use client';

import { cn } from 'cn';
import { useUserPresence } from './hooks/useUserPresence';

/** Three dots that rise in turn: someone is typing. Still when the reader prefers less motion. */
export function TypingDots({ className }: { className?: string }) {
    return (
        <span aria-hidden className={cn('inline-flex items-center gap-[3px] align-middle', className)}>
            {[0, 1, 2].map((index) => (
                <span
                    key={index}
                    className="size-[5px] rounded-full bg-current motion-reduce:animate-none"
                    style={{ animation: 'chat-dot 1.2s ease-in-out infinite', animationDelay: `${index * 0.16}s` }}
                />
            ))}
        </span>
    );
}

type UserStatusDisplayProps = {
    userId: string;
    /** A soft ring pulses around the dot while the person is online. */
    ping?: boolean;
    /** Also say it in words next to the dot. */
    showStatus?: boolean;
    typing?: boolean;
};

/**
 * The little green dot of someone who is online (nothing at all when they are not, like every messenger: an
 * absent dot says "offline" without a grey blob on every avatar), optionally with the status in words.
 * Place it in the corner of an avatar.
 */
export default function UserStatusDisplay({ userId, ping = false, showStatus = false, typing = false }: UserStatusDisplayProps) {
    const { online } = useUserPresence(userId);

    return (
        <span className="inline-flex items-center gap-1.5">
            {online && (
                <span className="relative flex size-3">
                    {ping && <span className="absolute inline-flex size-full animate-ping rounded-full bg-(--chat-online) opacity-60 motion-reduce:animate-none" />}
                    <span className="relative inline-flex size-3 rounded-full border-2 border-(--chat-surface) bg-(--chat-online)" />
                </span>
            )}

            {showStatus &&
                (typing ? (
                    <span className="text-xs font-medium text-(--chat-accent-text)">
                        typing <TypingDots />
                    </span>
                ) : (
                    <span className={cn('text-xs font-medium', online ? 'text-(--chat-online)' : 'text-(--chat-ink-3)')}>
                        {online ? 'Online' : 'Offline'}
                    </span>
                ))}
        </span>
    );
}
