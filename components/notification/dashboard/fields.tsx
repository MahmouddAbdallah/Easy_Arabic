'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CATEGORY_ICONS } from '../categoryIcons';
import { Switch } from '../Switch';
import { CATEGORY_ICON_NAMES, type CategoryIconName } from '../lib/config';

/**
 * The form building blocks of the notification dashboard. They know nothing about notifications: a field shows
 * its label, hint and error, and reports changes. Which error belongs to which field is the caller's business
 * (it comes from the editor's `issueAt`), so a field never validates anything itself.
 */

const controlClass =
    'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30';

// ─── Layout ───────────────────────────────────────────────────────────────────

export function Card({
    title,
    description,
    actions,
    children,
    className,
}: {
    title: string;
    description?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn('flex flex-col gap-4 rounded-xl border border-border bg-card p-4', className)}>
            <header className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{title}</h3>
                    {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
                </div>
                {actions}
            </header>
            {children}
        </section>
    );
}

/** Label, control, hint and error laid out the same way for every field. */
function FieldShell({
    id,
    label,
    hint,
    error,
    children,
    className,
}: {
    id: string;
    label: string;
    hint?: ReactNode;
    error?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
            <label htmlFor={id} className="text-sm font-medium leading-none">
                {label}
            </label>
            {children}
            {error ? (
                <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
                    {error}
                </p>
            ) : (
                hint && (
                    <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                        {hint}
                    </p>
                )
            )}
        </div>
    );
}

const describedBy = (id: string, error?: string, hint?: ReactNode) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

// ─── Inputs ───────────────────────────────────────────────────────────────────

export function TextField({
    label,
    value,
    onChange,
    error,
    hint,
    maxLength,
    placeholder,
    disabled,
    className,
    list,
    monospace,
    onBlur,
    onEnter,
    type = 'text',
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    hint?: ReactNode;
    maxLength?: number;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    /** id of a <datalist> to suggest values from. */
    list?: string;
    monospace?: boolean;
    /** The input type: "text", or "time" for a 24-hour clock field. */
    type?: 'text' | 'time';
    onBlur?: () => void;
    /** Called when Enter is pressed in the field. */
    onEnter?: () => void;
}) {
    const id = useId();
    return (
        <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
            <Input
                id={id}
                type={type}
                value={value}
                maxLength={maxLength}
                placeholder={placeholder}
                disabled={disabled}
                list={list}
                dir={type === 'time' ? undefined : 'auto'}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy(id, error, hint)}
                className={cn('h-8 text-sm md:text-sm', monospace && 'font-mono')}
                onChange={(event) => onChange(event.target.value)}
                onBlur={onBlur}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && onEnter) {
                        event.preventDefault(); // Enter in a field must not submit the page's form
                        onEnter();
                    }
                }}
            />
        </FieldShell>
    );
}

export function NumberField({
    label,
    value,
    onChange,
    error,
    hint,
    min,
    max,
    step = 1,
    suffix,
    disabled,
    className,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    error?: string;
    hint?: ReactNode;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
    disabled?: boolean;
    className?: string;
}) {
    const id = useId();
    const [text, setText] = useState(String(value));

    // Follow changes that did not come from typing (discard, restore defaults). While the person is typing, the number
    // their text stands for already equals `value`, so what they are in the middle of writing ("659.") is left alone.
    useEffect(() => {
        if (Number(text) !== value) setText(String(value));
    }, [value]);

    return (
        <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
            <div className="flex items-center gap-2">
                <Input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    value={text}
                    min={min}
                    max={max}
                    step={step}
                    disabled={disabled}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy(id, error, hint)}
                    className="h-8 text-sm tabular-nums md:text-sm"
                    onChange={(event) => {
                        setText(event.target.value);
                        const next = event.target.valueAsNumber;
                        if (!Number.isNaN(next)) onChange(next);
                    }}
                    onBlur={() => setText(String(value))}
                />
                {suffix && <span className="shrink-0 text-sm text-muted-foreground">{suffix}</span>}
            </div>
        </FieldShell>
    );
}

export function SelectField<T extends string>({
    label,
    value,
    onChange,
    options,
    error,
    hint,
    disabled,
    className,
}: {
    label: string;
    value: T;
    onChange: (value: T) => void;
    options: readonly { value: T; label: string }[];
    error?: string;
    hint?: ReactNode;
    disabled?: boolean;
    className?: string;
}) {
    const id = useId();
    return (
        <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
            <select
                id={id}
                value={value}
                disabled={disabled}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy(id, error, hint)}
                className={controlClass}
                onChange={(event) => onChange(event.target.value as T)}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </FieldShell>
    );
}

/** A labelled on/off switch with an explanation, laid out like the rows of the user's own settings screen. */
export function ToggleField({
    title,
    description,
    checked,
    onChange,
    disabled,
}: {
    title: string;
    description?: ReactNode;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}) {
    const id = useId();
    return (
        <div className={cn('flex items-start gap-3', disabled && 'opacity-60')}>
            <div className="min-w-0 flex-1">
                <p id={`${id}-title`} className="text-sm font-medium leading-6">
                    {title}
                </p>
                {description && (
                    <p id={`${id}-desc`} className="text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            <Switch
                checked={checked}
                onCheckedChange={onChange}
                disabled={disabled}
                aria-labelledby={`${id}-title`}
                aria-describedby={description ? `${id}-desc` : undefined}
            />
        </div>
    );
}

/** The icons a section may use, as a grid of buttons. */
export function IconPicker({ value, onChange, label }: { value: CategoryIconName; onChange: (icon: CategoryIconName) => void; label: string }) {
    const id = useId();
    return (
        <div className="flex flex-col gap-1.5">
            <span id={id} className="text-sm font-medium leading-none">
                {label}
            </span>
            <div role="group" aria-labelledby={id} className="flex flex-wrap gap-1">
                {CATEGORY_ICON_NAMES.map((name) => {
                    const Icon = CATEGORY_ICONS[name];
                    const selected = name === value;
                    return (
                        <button
                            key={name}
                            type="button"
                            aria-pressed={selected}
                            aria-label={name.replace(/-/g, ' ')}
                            title={name.replace(/-/g, ' ')}
                            onClick={() => onChange(name)}
                            className={cn(
                                'flex size-8 items-center justify-center rounded-lg border outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                                selected
                                    ? 'border-brand bg-brand-soft text-brand dark:bg-brand/15'
                                    : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                        >
                            <Icon className="size-4" aria-hidden="true" />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/** A 0–100 slider with its value shown. */
export function RangeField({
    label,
    value,
    onChange,
    error,
    hint,
    disabled,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    error?: string;
    hint?: ReactNode;
    disabled?: boolean;
}) {
    const id = useId();
    return (
        <FieldShell id={id} label={label} hint={hint} error={error}>
            <div className="flex items-center gap-3">
                <input
                    id={id}
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={value}
                    disabled={disabled}
                    aria-describedby={describedBy(id, error, hint)}
                    onChange={(event) => onChange(event.target.valueAsNumber)}
                    className="h-2 w-full cursor-pointer accent-brand disabled:cursor-not-allowed disabled:opacity-50"
                />
                <output htmlFor={id} className="w-12 shrink-0 text-end text-sm tabular-nums text-muted-foreground">
                    {value}%
                </output>
            </div>
        </FieldShell>
    );
}
