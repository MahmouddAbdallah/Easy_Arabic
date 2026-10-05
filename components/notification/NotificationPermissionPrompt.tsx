'use client';

import { useId } from 'react';
import { BellRing, X } from 'lucide-react';
import { Button } from '../ui/button';
import type { PermissionPrompt } from './hooks/usePermissionPrompt';

/**
 * Our own, friendlier version of "this site wants to send you notifications" — shown before the browser's
 * dialog, so the person knows what they would get and why. Not a modal: it never blocks the page, and
 * "Not now" (or ×, or Escape) lets it rest for 7 days.
 * When it appears is decided by usePermissionPrompt.
 */
export function NotificationPermissionPrompt({ prompt }: { prompt: PermissionPrompt }) {
    const titleId = useId();
    const descriptionId = useId();

    if (!prompt.visible) return null;

    return (
        <div
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onKeyDown={(event) => event.key === 'Escape' && prompt.dismiss()}
            className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex sm:inset-x-auto sm:bottom-5 sm:start-5"
        >
            <div className="pointer-events-auto relative w-full overflow-hidden rounded-2xl border border-border bg-card p-4 pe-10 text-card-foreground shadow-[0_20px_50px_-15px_rgba(0,0,0,0.35)] animate-in fade-in-0 slide-in-from-bottom-4 duration-300 sm:w-[24rem]">
                <div aria-hidden="true" className="pointer-events-none absolute -start-8 -top-8 size-28 rounded-full bg-brand/10 blur-2xl" />

                <button
                    type="button"
                    onClick={prompt.dismiss}
                    aria-label="Close"
                    className="absolute end-2.5 top-2.5 rounded-lg p-1.5 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                    <X className="size-4" aria-hidden="true" />
                </button>

                <div className="relative flex items-start gap-3.5">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand ring-1 ring-brand/20 dark:bg-brand/15">
                        <BellRing className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                        <h2 id={titleId} className="text-base font-semibold leading-6">
                            Stay in the loop
                        </h2>
                        <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
                            Get a heads-up about new messages and lesson updates, even when Easy Arabic isn&apos;t open. You can change this any
                            time in your notification settings.
                        </p>
                        <div className="mt-3.5 flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                size="lg"
                                onClick={() => void prompt.accept()}
                                className="bg-brand px-3.5 text-brand-foreground hover:bg-brand-deep"
                            >
                                Turn on notifications
                            </Button>
                            <Button type="button" variant="ghost" size="lg" onClick={prompt.dismiss}>
                                Not now
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
