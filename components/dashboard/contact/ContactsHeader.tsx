interface ContactsHeaderProps {
    /** Total messages in the inbox. Hidden when not provided. */
    total?: number;
    /** Unread messages in the inbox. Hidden when not provided. */
    unread?: number;
}

export function ContactsHeader({ total, unread }: ContactsHeaderProps) {
    return (
        <header className="flex flex-col gap-2 border-b border-border/40 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Contact Messages</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                    Review and respond to messages sent through your contact form.
                </p>
            </div>

            {(typeof total === "number" || typeof unread === "number") && (
                <p className="flex items-center gap-3 text-sm text-muted-foreground">
                    {typeof total === "number" && (
                        <span>
                            <span className="font-semibold text-foreground tabular-nums">{total}</span> total
                        </span>
                    )}
                    {typeof unread === "number" && (
                        <span className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-blue-500" aria-hidden />
                            <span className="font-semibold text-foreground tabular-nums">{unread}</span> unread
                        </span>
                    )}
                </p>
            )}
        </header>
    );
}
