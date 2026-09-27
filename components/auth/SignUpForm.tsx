'use client'

import { useForm, useWatch } from 'react-hook-form';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EyeIcon, EyeOffIcon, Loader2Icon } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

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

    const {
        register,
        handleSubmit,
        control,
        reset,
        formState: { errors, isSubmitting }
    } = useForm<FormInputs>();

    const { push, refresh } = useRouter();
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
            toast.success(data.message || 'Account created successfully');
            refresh();
            push('/');
        } catch (error: any) {
            toast.error(error?.response?.data?.error?.message || error?.response?.data?.message || 'Something went wrong');
        }
    });

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
                    aria-invalid={!!errors.name}
                    {...register('name', { required: 'Name is required' })}
                />
                {errors.name && (
                    <p className="text-xs text-destructive font-medium">{errors.name.message}</p>
                )}
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
                    aria-invalid={!!errors.email}
                    {...register('email', {
                        required: 'Email is required',
                        pattern: { value: EMAIL_PATTERN, message: 'Enter a valid email address' },
                    })}
                />
                {errors.email && (
                    <p className="text-xs text-destructive font-medium">{errors.email.message}</p>
                )}
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
                {errors.phone && (
                    <p className="text-xs text-destructive font-medium">{errors.phone.message}</p>
                )}
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
                        className="pr-10"
                        {...register('password', {
                            required: 'Password is required',
                            minLength: { value: 8, message: 'Password must be at least 8 characters' },
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
                {errors.password && (
                    <p className="text-xs text-destructive font-medium">{errors.password.message}</p>
                )}
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
                        className="pr-10"
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
                {errors.confirmPassword && (
                    <p className="text-xs text-destructive font-medium">{errors.confirmPassword.message}</p>
                )}
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