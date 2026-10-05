import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import IconTile from './IconTile';

export interface FeatureItem {
    icon: LucideIcon;
    title: string;
    desc: string;
}

interface FeatureListProps {
    items: readonly FeatureItem[];
    className?: string;
}

/** Stacked feature points: a teal icon tile beside a short title and one sentence of detail. */
export default function FeatureList({ items, className }: FeatureListProps) {
    return (
        <ul className={cn('space-y-6', className)}>
            {items.map((item) => (
                <li key={item.title} className="flex items-start gap-4">
                    <IconTile icon={item.icon} />
                    <div className="space-y-1">
                        <h3 className="text-base font-bold text-foreground">{item.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                </li>
            ))}
        </ul>
    );
}
