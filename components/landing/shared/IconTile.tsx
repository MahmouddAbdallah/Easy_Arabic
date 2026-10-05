import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZES = {
    sm: { box: 'p-2 rounded-lg', icon: 'size-4' },
    md: { box: 'p-2.5 rounded-xl', icon: 'size-5' },
    lg: { box: 'p-3 rounded-2xl', icon: 'size-6' },
} as const;

interface IconTileProps {
    icon: LucideIcon;
    size?: keyof typeof SIZES;
    className?: string;
}

/** A teal-tinted square holding one decorative icon. The text next to it carries the meaning. */
export default function IconTile({ icon: Icon, size = 'md', className }: IconTileProps) {
    const { box, icon } = SIZES[size];

    return (
        <span
            aria-hidden="true"
            className={cn('inline-flex w-fit shrink-0 border border-brand/20 bg-brand-soft text-brand', box, className)}
        >
            <Icon className={icon} />
        </span>
    );
}
