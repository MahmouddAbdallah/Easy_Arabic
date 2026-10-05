import Link from 'next/link';
import type { ComponentProps } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The landing page's button looks. Each tone picks a base shadcn variant plus the brand colours,
 * including the dark-mode overrides the `outline` variant would otherwise bring in.
 */
const TONES = {
    /** Primary action on a light surface. */
    brand: {
        variant: 'default',
        className: 'bg-brand text-brand-foreground hover:bg-brand/90',
    },
    /** Secondary action on a light surface. */
    outline: {
        variant: 'outline',
        className: 'border-border',
    },
    /** Quiet teal action inside a card. */
    brandOutline: {
        variant: 'outline',
        className:
            'border-brand/30 text-brand hover:bg-brand-soft hover:text-brand dark:border-brand/30 dark:bg-transparent dark:hover:bg-brand-soft',
    },
    /** Primary action on the always-dark teal panel. */
    gold: {
        variant: 'default',
        className: 'bg-gold text-[#2a1f04] hover:bg-gold/90',
    },
    /** Secondary action on the always-dark teal panel. */
    onDark: {
        variant: 'outline',
        className:
            'border-white/25 bg-white/5 text-white hover:bg-white/15 hover:text-white dark:border-white/25 dark:bg-white/5 dark:hover:bg-white/15',
    },
} as const;

interface LinkButtonProps extends ComponentProps<typeof Link> {
    tone?: keyof typeof TONES;
}

/**
 * A real link that looks like a button. Wrapping a `<button>` in a `<Link>` nests one interactive
 * element inside another (two tab stops, invalid HTML), so the link carries the button styles itself.
 * Full width on phones, content width from `sm` up; override with `className` (e.g. `sm:w-full`).
 */
export default function LinkButton({ tone = 'brand', className, ...props }: LinkButtonProps) {
    const { variant, className: toneClassName } = TONES[tone];

    return (
        <Link
            className={cn(
                buttonVariants({ variant }),
                'h-12 w-full gap-2 rounded-xl px-7 text-sm font-bold sm:w-auto',
                toneClassName,
                className
            )}
            {...props}
        />
    );
}
