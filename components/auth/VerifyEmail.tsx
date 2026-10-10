'use client'

import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2Icon } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import AuthNotice from '@/components/auth/AuthNotice';
import { useCountdown } from '@/hooks/useCountdown';
import { getApiError } from '@/lib/auth/client';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Status = 'verifying' | 'verified' | 'failed';

const VerifyEmail = ({ token }: { token?: string }) => {
    const [status, setStatus] = useState<Status>(token ? 'verifying' : 'failed');
    const [failMessage, setFailMessage] = useState('This verification link is invalid or has expired.');
    const [resent, setResent] = useState<string | null>(null);
    const cooldown = useCountdown();
    const started = useRef(false); // React strict mode runs effects twice; the token is single-use.
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>();

    useEffect(() => {
        if (!token || started.current) return;
        started.current = true;
        // A POST from the page (not the GET of opening the link) does the verifying,
        // so mail scanners that pre-fetch links can't burn the token.
        axios.post('/api/auth/verify-email', { token })
            .then(() => setStatus('verified'))
            .catch((error) => {
                setFailMessage(getApiError(error).message);
                setStatus('failed');
            });
    }, [token]);

    const resend = handleSubmit(async (formData) => {
        if (cooldown.active) return;
        try {
            const { data } = await axios.post('/api/auth/resend-verification', formData);
            setResent(data.message);
            cooldown.start(60);
        } catch (error: any) {
            const err = getApiError(error);
            if (err.retryAfterSeconds) cooldown.start(err.retryAfterSeconds);
            toast.error(err.message);
        }
    });

    if (status === 'verifying') {
        return (
            <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status" aria-live="polite">
                <Loader2Icon className="w-4 h-4 animate-spin" />
                Verifying your email...
            </div>
        );
    }

    if (status === 'verified') {
        return (
            <div className="space-y-4">
                <AuthNotice tone="success">
                    <p className="font-medium">Email verified</p>
                    <p>Thanks! Your email address is confirmed.</p>
                </AuthNotice>
                <Link href="/sign-in" className={buttonVariants({ className: 'w-full font-semibold' })}>
                    Continue to sign in
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <AuthNotice tone="error">
                <p className="font-medium">{failMessage}</p>
                <p>Enter your email and we&apos;ll send a fresh link.</p>
            </AuthNotice>
            {resent && (
                <AuthNotice tone="success">
                    <p>{resent}</p>
                </AuthNotice>
            )}
            <form onSubmit={resend} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                        id="email"
                        disabled={isSubmitting}
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        className='py-1'
                        aria-invalid={!!errors.email}
                        aria-describedby={errors.email ? 'email-error' : undefined}
                        {...register('email', {
                            required: 'Email is required',
                            pattern: { value: EMAIL_PATTERN, message: 'Enter a valid email address' },
                        })}
                    />
                    {errors.email && (
                        <p id="email-error" className="text-xs text-destructive font-medium">{errors.email.message}</p>
                    )}
                </div>
                <Button type="submit" disabled={isSubmitting || cooldown.active} className="w-full font-semibold">
                    {isSubmitting ? (
                        <>
                            <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                            Sending...
                        </>
                    ) : cooldown.active ? (
                        `Resend available in ${cooldown.remaining}s`
                    ) : (
                        'Send new verification link'
                    )}
                </Button>
            </form>
        </div>
    );
};

export default VerifyEmail;
