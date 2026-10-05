import { cn } from '@/lib/utils';
import type { FeatureItem } from './FeatureList';
import IconTile from './IconTile';

interface CapabilityGridProps {
    /** Visible heading above the grid. */
    title: string;
    items: readonly FeatureItem[];
    className?: string;
}

/** A row of small capability cards: for the "also included" things that don't need a full section. */
export default function CapabilityGrid({ title, items, className }: CapabilityGridProps) {
    return (
        <div className={cn('space-y-5', className)}>
            <h3 className="text-lg font-bold text-foreground">{title}</h3>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
                {items.map((item) => (
                    <li
                        key={item.title}
                        className="flex items-start gap-3.5 rounded-2xl border border-border/60 bg-card p-4 sm:p-5"
                    >
                        <IconTile icon={item.icon} size="sm" />
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-foreground">{item.title}</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
