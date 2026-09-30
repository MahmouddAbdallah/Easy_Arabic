import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
    icon: LucideIcon;
    label: string;
    value: string;
    hint?: string;
}

export default function StatCard({ icon: Icon, label, value, hint }: StatCardProps) {
    return (
        <Card className="border-border/60">
            <CardContent className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-brand-soft text-brand border border-brand/20 shrink-0">
                    <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <p className="text-2xl font-bold text-foreground tracking-tight truncate">{value}</p>
                    <p className="text-xs text-muted-foreground font-medium">{label}</p>
                    {hint && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{hint}</p>}
                </div>
            </CardContent>
        </Card>
    );
}
