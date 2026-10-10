'use client'

import { useForm } from 'react-hook-form';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useState } from 'react';
import Link from 'next/link';
import { Loader2Icon, MailIcon } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import AuthNotice from '@/components/auth/AuthNotice';
import { useCountdown } from '@/hooks/useCountdown';
import { getApiError } from '@/lib/auth/client';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPasswordForm = () => {
    const [sentMessage, setSentMessage] = useState<string | null>(null);
    const cooldown = useCountdown();
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>();

    const onSubmit = handleSubmit(async (formData) => {
        if (cooldown.active) return;
        try {
            const { data } = await axios.post('/api/auth/forgot-password', formData);
            // Same message whether or not the account exists (the server never says).
            setSentMessage(data.message);
            cooldown.start(60);
        } catch (error: any) {
            const err = getApiError(error);
            if (err.retryAfterSeconds) cooldown.start(err.retryAfterSeconds);
            toast.error(err.message);
        }
    });

    return (
        <div className="space-y-4">
            {sentMessage && (
                <AuthNotice tone="success">
                    <p className="font-medium">Check your inbox</p>
                    <p>{sentMessage} The link expires soon and works only once.</p>
                </AuthNotice>
            )}
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                    <Label htmlFor="email">Email address</Label>
                    <div className="relative flex items-center">
                        <MailIcon className="w-4 h-4 absolute left-3 text-muted-foreground pointer-events-none" />
                        <Input
                            id="email"
                            disabled={isSubmitting}
                            type="email"
                            placeholder="you@example.com"
                            autoComplete="email"
                            aria-invalid={!!errors.email}
                            aria-describedby={errors.email ? 'email-error' : undefined}
                            className="py-2 pl-9"
                            {...register('email', {
                                required: 'Email is required',
                                pattern: { value: EMAIL_PATTERN, message: 'Enter a valid email address' },
                            })}
                        />
                    </div>
                    {errors.email && (
                        <p id="email-error" className="text-xs text-destructive font-medium">{errors.email.message}</p>
                    )}
                </div>
                <Button type="submit" disabled={isSubmitting || cooldown.active} className="w-full mt-2 font-semibold">
                    {isSubmitting ? (
                        <>
                            <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                            Sending...
                        </>
                    ) : cooldown.active ? (
                        `Send again in ${cooldown.remaining}s`
                    ) : sentMessage ? (
                        'Send again'
                    ) : (
                        'Send reset link'
                    )}
                </Button>
            </form>
            <Link href="/sign-in" className={buttonVariants({ variant: 'ghost', className: 'w-full' })}>
                Back to sign in
            </Link>
        </div>
    );
};

export default ForgotPasswordForm;
