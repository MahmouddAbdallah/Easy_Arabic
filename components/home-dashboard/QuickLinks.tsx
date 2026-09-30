import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';

export interface QuickLink {
    href: string;
    label: string;
    description: string;
    icon: LucideIcon;
}

export default function QuickLinks({ links }: { links: QuickLink[] }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {links.map((link) => (
                <Link
                    key={link.href}
                    href={link.href}
                    className="group flex items-start gap-3 p-4 rounded-2xl border border-border/60 bg-card hover:border-brand/40 hover:bg-brand-soft/40 transition-colors"
                >
                    <div className="p-2 rounded-lg bg-brand-soft text-brand border border-brand/20 shrink-0">
                        <link.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 grow">
                        <p className="text-sm font-bold text-foreground flex items-center gap-1">
                            {link.label}
                            <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-brand" />
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{link.description}</p>
                    </div>
                </Link>
            ))}
        </div>
    );
}
