import type { ComponentProps } from 'react';
import { cn } from 'cn';

interface SectionProps extends ComponentProps<'section'> {
    /** `tinted` gives a quiet teal band so neighbouring sections don't blur together. */
    tone?: 'default' | 'tinted';
    /** Hairline along the bottom edge. The last section on the page turns it off. */
    divider?: boolean;
    /** Classes for the centred, max-width wrapper (usually vertical rhythm, e.g. `space-y-14`). */
    containerClassName?: string;
}

/**
 * One landing-page section: full-bleed background, consistent vertical padding and the shared
 * `max-w-7xl` content column. Pass `aria-labelledby` pointing at the section's heading id.
 */
export default function Section({
    tone = 'default',
    divider = true,
    className,
    containerClassName,
    children,
    ...props
}: SectionProps) {
    return (
        <section
            className={cn(
                // `isolate` keeps decorative `-z-10` layers (glows, patterns) above this section's own
                // background instead of slipping underneath it.
                'relative isolate w-full py-16 sm:py-20 lg:py-28',
                tone === 'tinted' ? 'bg-brand-soft/60 dark:bg-brand-soft/50' : 'bg-background',
                divider && 'border-b border-border/60',
                className
            )}
            {...props}
        >
            <div className={cn('container max-w-7xl mx-auto px-4 md:px-6', containerClassName)}>
                {children}
            </div>
        </section>
    );
}
