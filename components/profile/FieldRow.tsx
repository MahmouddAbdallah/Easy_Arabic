import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { FieldBadge, type FieldKind } from './FieldBadge';

/** One labelled line of the Settings page: label + who-controls-it badge on the left, value on the right. */
export function FieldRow({ icon: Icon, label, kind, htmlFor, hint, children }: {
    icon: LucideIcon;
    label: string;
    kind: FieldKind;
    htmlFor?: string;
    hint?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[13rem_1fr] sm:gap-6">
            <div className="flex flex-col items-start gap-1.5">
                <Label htmlFor={htmlFor} className="gap-2 text-foreground">
                    <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                    {label}
                </Label>
                <FieldBadge kind={kind} />
            </div>
            <div className="min-w-0">
                {children}
                {hint && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
            </div>
        </div>
    );
}

/** A value that cannot be edited here. A plain element (not a disabled input) so it stays selectable. */
export function StaticValue({ children, id }: { children: ReactNode; id?: string }) {
    return (
        <div id={id} className="min-h-8 wrap-break-word rounded-lg bg-muted/60 px-2.5 py-1.5 text-sm text-foreground">
            {children}
        </div>
    );
}
