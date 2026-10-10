'use client'

import { useState } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { EyeIcon, EyeOffIcon } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Same markup/classes as the password inputs in SignUpForm, packaged for reuse by the new auth forms. */
export default function PasswordField({
    id,
    label,
    placeholder,
    autoComplete,
    disabled,
    error,
    hint,
    registration,
}: {
    id: string
    label: string
    placeholder?: string
    autoComplete: string
    disabled?: boolean
    error?: string
    hint?: string
    registration: UseFormRegisterReturn
}) {
    const [show, setShow] = useState(false)
    const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            <div className="relative flex items-center">
                <Input
                    id={id}
                    disabled={disabled}
                    type={show ? 'text' : 'password'}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    aria-invalid={!!error}
                    aria-describedby={describedBy}
                    className="py-2 pr-10"
                    {...registration}
                />
                <button
                    type="button"
                    disabled={disabled}
                    aria-label={show ? 'Hide password' : 'Show password'}
                    aria-pressed={show}
                    onClick={() => setShow(!show)}
                    className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                    {show ? <EyeIcon className="w-4 h-4" /> : <EyeOffIcon className="w-4 h-4" />}
                </button>
            </div>
            {error ? (
                <p id={`${id}-error`} className="text-xs text-destructive font-medium">{error}</p>
            ) : hint ? (
                <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>
            ) : null}
        </div>
    )
}
