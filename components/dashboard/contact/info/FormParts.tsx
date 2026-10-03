'use client';

import type { ReactNode } from 'react';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Label + control + hint + inline error, laid out consistently across every form. */
export function Field({
    label,
    htmlFor,
    hint,
    error,
    optional,
    className,
    children,
}: {
    label: string;
    htmlFor: string;
    hint?: string;
    error?: string;
    optional?: boolean;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={cn('space-y-1.5', className)}>
            <Label htmlFor={htmlFor} className="text-xs font-semibold">
                {label}
                {optional && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
            </Label>
            {children}
            {error ? (
                <p role="alert" className="text-[11px] font-medium text-destructive">{error}</p>
            ) : hint ? (
                <p className="text-[11px] text-muted-foreground">{hint}</p>
            ) : null}
        </div>
    );
}

/** A titled group of fields inside a section card. */
export function FieldGroup({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
    return (
        <fieldset className="space-y-4">
            <legend className="sr-only">{title}</legend>
            <div>
                <h3 className="text-sm font-bold text-foreground">{title}</h3>
                {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
        </fieldset>
    );
}

/**
 * Card shell for one saveable section: header, body and a footer with
 * Save / Discard. Save stays disabled until something changed.
 */
export function SectionForm({
    title,
    description,
    isDirty,
    isSaving,
    onSubmit,
    onReset,
    children,
}: {
    title: string;
    description: string;
    isDirty: boolean;
    isSaving: boolean;
    onSubmit: () => void;
    onReset: () => void;
    children: ReactNode;
}) {
    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
            }}
            noValidate
            className="rounded-2xl border border-border/60 bg-card shadow-sm"
        >
            <div className="border-b border-border/50 px-4 py-4 sm:px-6">
                <h2 className="text-base font-bold tracking-tight text-foreground">{title}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            </div>

            <div className="space-y-8 px-4 py-5 sm:px-6 sm:py-6">{children}</div>

            <div className="flex flex-col-reverse gap-3 rounded-b-2xl border-t border-border/50 bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p className="text-xs text-muted-foreground" aria-live="polite">
                    {isDirty ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                            <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
                            Unsaved changes
                        </span>
                    ) : (
                        'All changes saved'
                    )}
                </p>
                <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="flex-1 rounded-lg sm:flex-none" disabled={!isDirty || isSaving} onClick={onReset}>
                        <RotateCcw className="h-3.5 w-3.5" />
                        Discard
                    </Button>
                    <Button type="submit" size="sm" className="flex-1 rounded-lg sm:flex-none" disabled={!isDirty || isSaving}>
                        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        {isSaving ? 'Saving…' : 'Save changes'}
                    </Button>
                </div>
            </div>
        </form>
    );
}
