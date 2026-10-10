'use client'

import { useForm } from 'react-hook-form';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { useState } from 'react';
import { EyeIcon, EyeOffIcon, Loader2Icon, MailIcon, LockIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import AuthNotice from '@/components/auth/AuthNotice';
import { useCountdown } from '@/hooks/useCountdown';
import { formatCountdown, getApiError } from '@/lib/auth/client';
import ErrorMsg from '../ErrorMsg';

interface FormInputs {
    email: string;
    password?: string;
}

const SignInForm = () => {
    const [showPass, setShowPass] = useState(false);
    // Set when the server says the email still has to be verified.
    const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
    const [resending, setResending] = useState(false);
    const lockout = useCountdown();
    const resendCooldown = useCountdown();

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormInputs>();

    const onSubmit = handleSubmit(async (formData) => {
        if (lockout.active) return;
        setUnverifiedEmail(null);
        try {
            const { data } = await axios.post(`/api/auth/sign-in`, formData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            toast.success(data.message || 'Signed in successfully');
            reset();
            window.location.reload();
        } catch (error: any) {
            const err = getApiError(error);
            if (err.code === 'LOGIN_LOCKED' && err.retryAfterSeconds) {
                // Temporary, server-enforced lockout: show the countdown instead of a toast.
                lockout.start(err.retryAfterSeconds);
            } else if (err.code === 'EMAIL_NOT_VERIFIED') {
                setUnverifiedEmail(formData.email);
            } else {
                toast.error(err.message);
            }
        }
    });

    const resendVerification = async () => {
        if (!unverifiedEmail || resending || resendCooldown.active) return;
        setResending(true);
        try {
            const { data } = await axios.post('/api/auth/resend-verification', { email: unverifiedEmail });
            toast.success(data.message);
            resendCooldown.start(60);
        } catch (error: any) {
            const err = getApiError(error);
            if (err.retryAfterSeconds) resendCooldown.start(err.retryAfterSeconds);
            toast.error(err.message);
        } finally {
            setResending(false);
        }
    };

    return (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {/* Email Address */}
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
                        className="py-2 pl-9"
                        {...register('email', { required: 'Email is required' })}
                    />
                </div>
                {<ErrorMsg message={errors.email?.message} />}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                        href="/forgot-password"
                        className="text-xs text-primary hover:underline font-medium"
                    >
                        Forgot password?
                    </Link>
                </div>
                <div className="relative flex items-center">
                    <LockIcon className="w-4 h-4 absolute left-3 text-muted-foreground pointer-events-none" />
                    <Input
                        id="password"
                        disabled={isSubmitting}
                        type={showPass ? 'text' : 'password'}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        aria-invalid={!!errors.password}
                        className="py-2 pl-9 pr-10"
                        {...register('password', { required: 'Password is required' })}
                    />
                    <button
                        type="button"
                        disabled={isSubmitting}
                        aria-label={showPass ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                        {showPass ? <EyeIcon className="w-4 h-4" /> : <EyeOffIcon className="w-4 h-4" />}
                    </button>
                </div>
                {<ErrorMsg message={errors.password?.message} />}
            </div>

            {/* Temporary lockout (server-enforced) */}
            {lockout.active && (
                <AuthNotice tone="error">
                    <p className="font-medium">Too many failed attempts.</p>
                    <p>
                        For your security, sign-in is paused. You can try again in{' '}
                        <span className="font-semibold tabular-nums" aria-hidden="true">{formatCountdown(lockout.remaining)}</span>
                        <span className="sr-only">{Math.ceil(lockout.remaining / 60)} minute(s)</span>.
                    </p>
                </AuthNotice>
            )}

            {/* Email not verified yet */}
            {unverifiedEmail && (
                <AuthNotice tone="info">
                    <p className="font-medium">Please verify your email to continue.</p>
                    <p className="text-muted-foreground">We sent a link when you signed up. Can&apos;t find it?</p>
                    <button
                        type="button"
                        onClick={resendVerification}
                        disabled={resending || resendCooldown.active}
                        className="text-primary hover:underline font-semibold disabled:opacity-50 disabled:no-underline"
                    >
                        {resendCooldown.active
                            ? `Resend available in ${resendCooldown.remaining}s`
                            : resending ? 'Sending...' : 'Resend verification email'}
                    </button>
                </AuthNotice>
            )}

            {/* Submit Button */}
            <Button
                type="submit"
                disabled={isSubmitting || lockout.active}
                className="w-full mt-2 font-semibold"
            >
                {isSubmitting ? (
                    <>
                        <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                        Signing in...
                    </>
                ) : lockout.active ? (
                    `Try again in ${formatCountdown(lockout.remaining)}`
                ) : (
                    'Sign in'
                )}
            </Button>
        </form>
    );
};

export default SignInForm;