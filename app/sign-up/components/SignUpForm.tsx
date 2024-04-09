'use client'
import clsx from 'clsx';
import { useForm } from 'react-hook-form';
import ErrorMsg from '../../component/ErrorMsg';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useState } from 'react';
import { useRouter } from 'next/navigation'
import { EyeIcon, EyeOffIcon, LoadingIcon } from '@/app/component/icons';

const SignUpForm = ({ role }: { role: string }) => {

    const router = useRouter()
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const { register, handleSubmit, watch, reset, formState: { errors, isValid } } = useForm();

    const onSubmit = handleSubmit(async (formData) => {
        try {
            setLoading(true);
            setShowPass(false)
            const { data } = await axios.post(`/api/auth/sign-up/${role}`, { ...formData }, {
                headers: {
                    'Content-Type': 'application/json',
                    "Accept": 'application/json'
                }
            })
            toast.success(data.message);
            setLoading(false)
            reset();
            router.push("/dashboard")
            setTimeout(() => {
                document.location.reload()
            }, 2000)
        } catch (error: any) {
            setLoading(false)
            toast.error(error?.response?.data?.message || 'There is an error');
            console.error(error);
        }
    })
    return (
        <div className=''>
            <form onSubmit={onSubmit} className='space-y-5'>
                <input
                    disabled={loading}
                    type="name"
                    placeholder='Full Name'
                    className={clsx(
                        'p-2 rounded-md w-full border outline-none focus:border-blue-500 placeholder:text-sm',
                        { 'border-red-500 focus:border-red-500': errors?.name?.message }
                    )}
                    {...register('name', { required: 'The name is required' })}
                />
                <ErrorMsg message={errors.name?.message as string} />
                <input
                    disabled={loading}
                    type="text"
                    placeholder='Email Address'
                    className={clsx(
                        'p-2 rounded-md w-full border outline-none focus:border-blue-500 placeholder:text-sm',
                        { 'border-red-500 focus:border-red-500': errors?.email?.message }
                    )}
                    {...register('email', { required: 'The email is required' })}
                />
                <ErrorMsg message={errors.email?.message as string} />
                <input
                    disabled={loading}
                    type="text"
                    placeholder='Phone number'
                    className={clsx(
                        'p-2 rounded-md w-full border outline-none focus:border-blue-500 placeholder:text-sm',
                        { 'border-red-500 focus:border-red-500': errors?.phone?.message }
                    )}
                    {...register('phone', { required: 'The phone is required' })}
                />
                <ErrorMsg message={errors.phone?.message as string} />
                <div className='relative flex items-center'>
                    <input
                        disabled={loading}
                        type={showPass ? 'text' : 'password'}
                        placeholder='Password'
                        className={clsx(
                            'p-2 rounded-md w-full border outline-none focus:border-blue-500 placeholder:text-sm',
                            { 'border-red-500 focus:border-red-500': errors?.password?.message }
                        )}
                        {...register('password', { required: 'The password is required' })}
                    />
                    <button
                        disabled={loading}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            setShowPass(!showPass)
                        }} className='absolute right-3'>
                        {showPass ? <EyeIcon className='w-5 h-5 fill-blue-500' /> :
                            <EyeOffIcon className='w-5 h-5 fill-blue-500' />
                        }
                    </button>
                </div>
                <ErrorMsg message={errors.password?.message as string} />
                <input
                    disabled={loading}
                    type="password"
                    placeholder='Confirm password'
                    className={clsx(
                        'p-2 rounded-md w-full border outline-none focus:border-blue-500 placeholder:text-sm',
                        { 'border-red-500 focus:border-red-500': errors?.password?.message }
                    )}
                    {...register('confirmPassword', {
                        required: 'Please Enter Password',
                        validate: (val) => {
                            if (!val) {
                                return "Please enter your password again.";
                            } else if (watch('password') != val) {
                                return "Passwords do not match!";
                            }
                        }
                    })}
                />
                <ErrorMsg message={errors.confirmPassword?.message as string} />
                <button
                    disabled={!isValid || loading}
                    className='w-full bg-blue-500 disabled:bg-blue-400 text-sm text-white p-2 rounded-md flex justify-center items-center'>
                    {loading ? <LoadingIcon className='animate-spin w-5 h-5' /> : "Sign Up"}
                </button>
            </form>
        </div>
    )
}

export default SignUpForm