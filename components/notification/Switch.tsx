'use client';

import { cn } from 'cn';

interface SwitchProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
    'aria-label'?: string;
}

/** An on/off switch (role="switch"): a button, so it is keyboard-operable and announced correctly. */
export function Switch({ checked, onCheckedChange, disabled, ...aria }: SwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onCheckedChange(!checked)}
            className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent outline-none transition-colors',
                'focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
                checked ? 'bg-brand' : 'bg-muted-foreground/35'
            )}
            {...aria}
        >
            <span
                aria-hidden="true"
                className={cn(
                    'pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none',
                    checked ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0.5 rtl:-translate-x-0.5'
                )}
            />
        </button>
    );
}
