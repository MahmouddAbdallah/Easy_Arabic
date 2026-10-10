'use client';

import { X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from 'cn';
import { markNotificationHandled } from './lib/client/api';
import type { NotificationPayload } from './lib/contract';
import { TYPE_ICONS } from './typeIcons';

/** How long a pop-up stays when the caller does not say (the notification configuration sets it: delivery.popupDurationMs). */
const IN_APP_TOAST_MS = 6000;

/**
 * Shows an incoming push as an in-app toast. Clicking it handles the notification — its stored copy is no
 * longer needed — and then calls `open` with the notification's link; the × only closes the toast.
 * A notification about the same thing as one already on screen (same tag, or the same stored notification)
 * replaces that toast instead of stacking another.
 */
export function showNotificationToast(payload: NotificationPayload, open: (link?: string) => void, durationMs: number = IN_APP_TOAST_MS) {
    toast.custom(
        (t) => (
            <NotificationToast
                payload={payload}
                visible={t.visible}
                onOpen={() => {
                    toast.dismiss(t.id);
                    if (payload.key) markNotificationHandled(payload.key);
                    open(payload.link);
                }}
                onDismiss={() => toast.dismiss(t.id)}
            />
        ),
        { id: payload.tag ?? payload.key ?? payload.id, duration: durationMs }
    );
}

interface NotificationToastProps {
    payload: NotificationPayload;
    /** react-hot-toast's `t.visible` — drives the enter/exit animation. */
    visible: boolean;
    /** Clicked on the notification itself: it is handled, and the provider navigates to `payload.link` if any. */
    onOpen: () => void;
    /** The × button: closes the toast only — the notification stays unhandled in the list. */
    onDismiss: () => void;
}

/** Luxury & High-End Action Push Notification Toast. */
export function NotificationToast({ payload, visible, onOpen, onDismiss }: NotificationToastProps) {
    const Icon = TYPE_ICONS[payload.type];

    return (
        <div
            role="status"
            className={cn(
                'group pointer-events-auto relative flex min-h-27.5 w-full max-w-md items-center overflow-hidden rounded-2xl p-[1.5px] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.35)] transition-all duration-500 ease-out hover:-translate-y-1.5 hover:shadow-[0_25px_60px_-12px_var(--brand-deep)]/25 active:scale-[0.99]',
                visible
                    ? 'animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-5 duration-400 cubic-bezier(0.16, 1, 0.3, 1)'
                    : 'animate-out fade-out-0 zoom-out-95 slide-out-to-top-3 duration-200'
            )}
        >
            <span
                className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_280deg,var(--brand-deep)_340deg,#ffffff_360deg)] opacity-80 transition-opacity duration-300 group-hover:opacity-100"
            />

            <span
                className="absolute inset-[-1000%] animate-[spin_3.5s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_260deg,var(--brand-deep)_360deg)] blur-2xl opacity-35 transition-all duration-500 group-hover:opacity-65 group-hover:blur-3xl"
            />

            <div className="relative flex size-full min-h-26.75 items-center overflow-hidden rounded-[14.5px] bg-card/95 p-5 backdrop-blur-2xl">

                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/40 to-transparent" />

                <div className="pointer-events-none absolute inset-0 -translate-x-full rotate-12 bg-linear-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 ease-in-out group-hover:translate-x-full" />

                <div className="absolute left-3 top-1/2 -z-10 size-16 -translate-y-1/2 rounded-full bg-brand-deep/20 blur-xl transition-all duration-500 group-hover:scale-150 group-hover:bg-brand-deep/35" />

                <button
                    type="button"
                    onClick={onOpen}
                    className="flex min-w-0 flex-1 items-center gap-4 text-start outline-none focus-visible:ring-2 focus-visible:ring-brand-deep/50 rounded-xl"
                >
                    <span className="relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-deep/10 text-brand-deep ring-1 ring-brand-deep/30 transition-all duration-300 group-hover:scale-105 group-hover:bg-brand-deep group-hover:text-white group-hover:shadow-lg group-hover:shadow-brand-deep/40 group-hover:ring-white/30">
                        <Icon className="size-6 transition-transform duration-300 group-hover:rotate-6" aria-hidden="true" />
                    </span>

                    <span className="min-w-0 flex-1 space-y-1">
                        <span dir="auto" className="block truncate text-base font-bold tracking-tight text-foreground transition-colors duration-200 group-hover:text-brand-deep">
                            {payload.title}
                        </span>
                        <span dir="auto" className="line-clamp-2 block text-sm font-medium leading-relaxed text-muted-foreground/90">
                            {payload.body}
                        </span>
                        <span>
                            {payload?.data?.message}
                        </span>
                    </span>
                </button>

                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Dismiss notification"
                    className="ml-3 self-start rounded-xl p-2 text-muted-foreground/60 transition-all duration-300 hover:bg-brand-deep/15 hover:text-brand-deep hover:rotate-90 focus-visible:ring-2 focus-visible:ring-brand-deep/50 active:scale-90"
                >
                    <X className="size-4" aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}