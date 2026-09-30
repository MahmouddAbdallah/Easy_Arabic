'use client'

import { useForm, useWatch } from 'react-hook-form';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2Icon } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import AuthNotice from '@/components/auth/AuthNotice';
import PasswordField from '@/components/auth/PasswordField';
import { useCountdown } from '@/hooks/useCountdown';
import { formatWait, getApiError, passwordTooLong, PASSWORD_MAX_BYTES } from '@/lib/auth/client';

interface FormInputs { newPassword: string; confirmPassword: string }

const ResetPasswordForm = ({ token }: { token?: string }) => {
    const router = useRouter();
    const [linkInvalid, setLinkInvalid] = useState(!token);
    const cooldown = useCountdown();
    const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormInputs>();
    const watchPassword = useWatch({ control, name: 'newPassword' });

    if (linkInvalid) {
        return (
            <div className="space-y-4">
                <AuthNotice tone="error">
                    <p className="font-medium">This reset link is invalid or has expired.</p>
                    <p>Reset links work once and expire quickly. Request a new one to continue.</p>
                </AuthNotice>
                <Link href="/forgot-password" className={buttonVariants({ className: 'w-full font-semibold' })}>
                    Request a new link
                </Link>
            </div>
        );
    }

    const onSubmit = handleSubmit(async ({ newPassword }) => {
        if (cooldown.active) return;
        try {
            const { data } = await axios.post('/api/auth/reset-password', { token, newPassword });
            toast.success(data.message);
            // Deliberately not signed in: they sign in with the new password.
            router.push('/sign-in');
        } catch (error: any) {
            const err = getApiError(error);
            if (err.code === 'INVALID_TOKEN') return setLinkInvalid(true);
            if (err.retryAfterSeconds) {
                cooldown.start(err.retryAfterSeconds);
                return toast.error(`${err.message} Try again in ${formatWait(err.retryAfterSeconds)}.`);
            }
            toast.error(err.message);
        }
    });

    return (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <PasswordField
                id="newPassword"
                label="New password"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                disabled={isSubmitting}
                error={errors.newPassword?.message}
                registration={register('newPassword', {
                    required: 'Password is required',
                    minLength: { value: 8, message: 'Password must be at least 8 characters' },
                    validate: (v) => !passwordTooLong(v) || `Password is too long (maximum ${PASSWORD_MAX_BYTES} bytes)`,
                })}
            />
            <PasswordField
                id="confirmPassword"
                label="Confirm new password"
                placeholder="Re-enter your password"
                autoComplete="new-password"
                disabled={isSubmitting}
                error={errors.confirmPassword?.message}
                registration={register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (val) => watchPassword === val || 'Passwords do not match',
                })}
            />
            <Button type="submit" disabled={isSubmitting || cooldown.active} className="w-full mt-2 font-semibold">
                {isSubmitting ? (
                    <>
                        <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                        Resetting...
                    </>
                ) : cooldown.active ? (
                    `Try again in ${cooldown.remaining}s`
                ) : (
                    'Reset password'
                )}
            </Button>
        </form>
    );
};

export default ResetPasswordForm;
