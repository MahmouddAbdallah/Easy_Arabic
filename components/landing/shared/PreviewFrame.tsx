import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PreviewFrameProps {
    /** What the illustration shows, for screen readers. Its contents are treated as one image. */
    label: string;
    /** Visible note under the frame; says plainly that this is an illustration, not live data. */
    caption: string;
    children: ReactNode;
    className?: string;
}

/**
 * Wraps a hand-built product illustration (a chat window, a notification inbox) in the same
 * soft-glow card used by the hero and About images. The inner markup is decorative, so it is
 * exposed to assistive tech as a single labelled image.
 */
export default function PreviewFrame({ label, caption, children, className }: PreviewFrameProps) {
    return (
        <figure className={cn('relative', className)}>
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 rounded-[32px] bg-linear-to-tr from-brand/15 to-gold/10 blur-3xl"
            />
            <div
                role="img"
                aria-label={label}
                className="relative overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-xl"
            >
                {children}
            </div>
            <figcaption className="mt-4 text-center text-xs text-muted-foreground">{caption}</figcaption>
        </figure>
    );
}
