'use client'

import { useForm, useWatch } from 'react-hook-form';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useState } from 'react';
import Link from 'next/link';
import { EyeIcon, EyeOffIcon, Loader2Icon } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import AuthNotice from '@/components/auth/AuthNotice';
import { formatWait, getApiError, passwordTooLong, PASSWORD_MAX_BYTES } from '@/lib/auth/client';
import ErrorMsg from '../ErrorMsg';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormInputs {
    name: string;
    email: string;
    phone: string;
    password?: string;
    confirmPassword?: string;
}

const SignUpForm = () => {
    const [showPass, setShowPass] = useState(false);
    const [showPassConfirm, setShowPassConfirm] = useState(false);
    // Set after a successful submit. The server answers identically whether or
    // not the email was already registered, so we can't sign the user in here.
    const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        control,
        reset,
        formState: { errors, isSubmitting }
    } = useForm<FormInputs>();

    const watchPassword = useWatch({ control, name: 'password' });

    const onSubmit = handleSubmit(async (formData) => {
        try {
            const { data } = await axios.post(`/api/auth/sign-up`, formData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            reset();
            setSubmittedMessage(data.message || 'Check your inbox to verify your email, then sign in.');
        } catch (error: any) {
            const err = getApiError(error);
            toast.error(err.retryAfterSeconds ? `${err.message} Try again in ${formatWait(err.retryAfterSeconds)}.` : err.message);
        }
    });

    if (submittedMessage) {
        return (
            <div className="space-y-4">
                <AuthNotice tone="success">
                    <p className="font-medium">Almost there!</p>
                    <p>{submittedMessage}</p>
                </AuthNotice>
                <Link href="/sign-in" className={buttonVariants({ className: 'w-full font-semibold' })}>
                    Go to sign in
                </Link>
            </div>
        );
    }

    return (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {/* Full Name */}
            <div className="space-y-1.5">
                <Label htmlFor="name">Full Name</Label>
                <Input
                    id="name"
                    disabled={isSubmitting}
                    type="text"
                    placeholder="John Doe"
                    autoComplete="name"
                    className='py-1'
                    aria-invalid={!!errors.name}
                    maxLength={100}
                    {...register('name', { required: 'Name is required', validate: (v) => v.trim().length > 0 || 'Name is required' })}
                />
                {<ErrorMsg message={errors.name?.message} />}

            </div>

            {/* Email */}
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
                    {...register('email', {
                        required: 'Email is required',
                        pattern: { value: EMAIL_PATTERN, message: 'Enter a valid email address' },
                    })}
                />
                {<ErrorMsg message={errors.email?.message} />}
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                    id="phone"
                    disabled={isSubmitting}
                    type="tel"
                    placeholder="+1 234 567 890"
                    autoComplete="tel"
                    aria-invalid={!!errors.phone}
                    {...register('phone', { required: 'Phone number is required' })}
                />
                {<ErrorMsg message={errors.phone?.message} />}

            </div>

            {/* Password */}
            <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative flex items-center">
                    <Input
                        id="password"
                        disabled={isSubmitting}
                        type={showPass ? 'text' : 'password'}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        aria-invalid={!!errors.password}
                        className="py-2 pr-10"
                        {...register('password', {
                            required: 'Password is required',
                            minLength: { value: 8, message: 'Password must be at least 8 characters' },
                            validate: (v) => !passwordTooLong(v ?? '') || `Password is too long (maximum ${PASSWORD_MAX_BYTES} bytes)`,
                        })}
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

            {/* Confirm Password */}
            <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative flex items-center">
                    <Input
                        id="confirmPassword"
                        disabled={isSubmitting}
                        type={showPassConfirm ? 'text' : 'password'}
                        placeholder="Re-enter your password"
                        autoComplete="new-password"
                        aria-invalid={!!errors.confirmPassword}
                        className="py-2 pr-10"
                        {...register('confirmPassword', {
                            required: 'Please confirm your password',
                            validate: (val) => watchPassword === val || 'Passwords do not match',
                        })}
                    />
                    <button
                        type="button"
                        disabled={isSubmitting}
                        aria-label={showPassConfirm ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassConfirm(!showPassConfirm)}
                        className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                        {showPassConfirm ? <EyeIcon className="w-4 h-4" /> : <EyeOffIcon className="w-4 h-4" />}
                    </button>
                </div>
                {<ErrorMsg message={errors.confirmPassword?.message} />}
            </div>

            {/* Submit Button */}
            <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 font-semibold"
            >
                {isSubmitting ? (
                    <>
                        <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                        Creating account...
                    </>
                ) : (
                    'Create account'
                )}
            </Button>
        </form>
    );
};

export default SignUpForm;