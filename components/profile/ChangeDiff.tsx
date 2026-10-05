import { ArrowRight } from 'lucide-react';
import { PROFILE_FIELDS, PROFILE_FIELD_LABELS } from '@/lib/profile/rules';
import type { ProfileValues } from '@/lib/profile/validation';

/**
 * "Field: old -> new" for every field in a request. `current` is what the profile held when the
 * request was sent (or, in the admin dialog, what it holds now).
 */
export function ChangeDiff({ requested, current }: { requested: ProfileValues; current: ProfileValues }) {
    const fields = PROFILE_FIELDS.filter((f) => requested[f] !== undefined);
    if (fields.length === 0) return <p className="text-sm text-muted-foreground">No details.</p>;

    return (
        <dl className="space-y-2">
            {fields.map((field) => (
                <div key={field} className="rounded-lg border bg-muted/30 p-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{PROFILE_FIELD_LABELS[field]}</dt>
                    <dd className="mt-1 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-2">
                        <span className="break-all text-muted-foreground line-through decoration-muted-foreground/40">{current[field] ?? '-'}</span>
                        <ArrowRight className="hidden size-3.5 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
                        <span className="break-all font-medium text-foreground">{requested[field]}</span>
                    </dd>
                </div>
            ))}
        </dl>
    );
}
