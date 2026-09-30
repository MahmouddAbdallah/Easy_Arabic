'use client'

import { useForm, useWatch } from 'react-hook-form';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Loader2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import AuthNotice from '@/components/auth/AuthNotice';
import PasswordField from '@/components/auth/PasswordField';
import { useCountdown } from '@/hooks/useCountdown';
import { formatCountdown, getApiError, passwordTooLong, PASSWORD_MAX_BYTES } from '@/lib/auth/client';

interface FormInputs { currentPassword: string; newPassword: string; confirmPassword: string }

const ChangePasswordForm = () => {
    const router = useRouter();
    const lockout = useCountdown();
    const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<FormInputs>();
    const watchNew = useWatch({ control, name: 'newPassword' });

    const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
        if (lockout.active) return;
        try {
            const { data } = await axios.post('/api/auth/change-password', { currentPassword, newPassword });
            toast.success(data.message);
            reset();
            // Navigate first, then refresh: refreshing before the push doesn't
            // reliably refetch the root layout, leaving the navbar signed-out.
            router.push('/');
            router.refresh();
        } catch (error: any) {
            const err = getApiError(error);
            if (err.status === 401) return router.push('/sign-in');
            if (err.code === 'PASSWORD_CHANGE_LOCKED' && err.retryAfterSeconds) return lockout.start(err.retryAfterSeconds);
            toast.error(err.message);
        }
    });

    return (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <PasswordField
                id="currentPassword"
                label="Current password"
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={isSubmitting}
                error={errors.currentPassword?.message}
                registration={register('currentPassword', { required: 'Enter your current password' })}
            />
            <PasswordField
                id="newPassword"
                label="New password"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                disabled={isSubmitting}
                error={errors.newPassword?.message}
                hint="You'll stay signed in here and be signed out everywhere else."
                registration={register('newPassword', {
                    required: 'Password is required',
                    minLength: { value: 8, message: 'Password must be at least 8 characters' },
                    validate: (v) => !passwordTooLong(v) || `Password is too long (maximum ${PASSWORD_MAX_BYTES} bytes)`,
                })}
            />
            <PasswordField
                id="confirmPassword"
                label="Confirm new password"
                placeholder="Re-enter your new password"
                autoComplete="new-password"
                disabled={isSubmitting}
                error={errors.confirmPassword?.message}
                registration={register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (val) => watchNew === val || 'Passwords do not match',
                })}
            />
            {lockout.active && (
                <AuthNotice tone="error">
                    <p className="font-medium">Too many incorrect attempts.</p>
                    <p>
                        Please wait{' '}
                        <span className="font-semibold tabular-nums">{formatCountdown(lockout.remaining)}</span>{' '}
                        before trying again.
                    </p>
                </AuthNotice>
            )}
            <Button type="submit" disabled={isSubmitting || lockout.active} className="w-full mt-2 font-semibold">
                {isSubmitting ? (
                    <>
                        <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                        Updating...
                    </>
                ) : lockout.active ? (
                    `Try again in ${formatCountdown(lockout.remaining)}`
                ) : (
                    'Change password'
                )}
            </Button>
        </form>
    );
};

export default ChangePasswordForm;
