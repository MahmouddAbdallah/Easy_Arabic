'use client'

import { useForm } from 'react-hook-form';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EyeIcon, EyeOffIcon, Loader2Icon, MailIcon, LockIcon } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface FormInputs {
    email: string;
    password?: string;
}

const SignInForm = () => {
    const [showPass, setShowPass] = useState(false);
    const router = useRouter();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting }
    } = useForm<FormInputs>();

    const onSubmit = handleSubmit(async (formData) => {
        try {
            const { data } = await axios.post(`/api/auth/sign-in`, formData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            localStorage.setItem('user', JSON.stringify(data.user));
            toast.success(data.message || 'Signed in successfully');
            reset();
            router.refresh();
            router.push('/');
        } catch (error: any) {
            toast.error(error?.response?.data?.error?.message || error?.response?.data?.message || 'Something went wrong');
        }
    });

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
                        className="pl-9"
                        {...register('email', { required: 'Email is required' })}
                    />
                </div>
                {errors.email && (
                    <p className="text-xs text-destructive font-medium">{errors.email.message}</p>
                )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
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
                        className="pl-9 pr-10"
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
                {errors.password && (
                    <p className="text-xs text-destructive font-medium">{errors.password.message}</p>
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
                        Signing in...
                    </>
                ) : (
                    'Sign in'
                )}
            </Button>
        </form>
    );
};

export default SignInForm;