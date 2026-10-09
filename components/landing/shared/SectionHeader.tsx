import { cn } from 'cn';

interface SectionHeaderProps {
    /** Id of the `<h2>`. Point the parent section's `aria-labelledby` at it. */
    id: string;
    title: string;
    eyebrow?: string;
    description?: string;
    align?: 'center' | 'left';
    className?: string;
}

/** The eyebrow + display headline + intro paragraph that opens every landing section. */
export default function SectionHeader({
    id,
    title,
    eyebrow,
    description,
    align = 'center',
    className,
}: SectionHeaderProps) {
    const centered = align === 'center';

    return (
        <div
            className={cn(
                'space-y-4',
                centered ? 'mx-auto flex max-w-2xl flex-col items-center text-center' : 'max-w-xl',
                className
            )}
        >
            {eyebrow && (
                <span className="text-xs font-bold tracking-wider text-brand uppercase">{eyebrow}</span>
            )}
            <h2
                id={id}
                className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-[1.15] text-balance"
            >
                {title}
            </h2>
            {description && (
                <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">{description}</p>
            )}
        </div>
    );
}
