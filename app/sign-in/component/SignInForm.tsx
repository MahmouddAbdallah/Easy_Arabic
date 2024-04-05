'use client'
import clsx from 'clsx';
import { useForm } from 'react-hook-form';
import ErrorMsg from '../../component/ErrorMsg';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation'
import { LoadingIcon } from '@/app/component/icons';
import { useState } from 'react';

const SignInForm = ({ role }: { role: string }) => {

    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const { register, handleSubmit, formState: { errors, isValid } } = useForm();


    const onSubmit = handleSubmit(async (formData) => {
        try {
            setLoading(true)
            const { data } = await axios.post(`/api/auth/sign-in/${role}`, { ...formData }, {
                headers: {
                    'Content-Type': 'application/json',
                    "Accept": 'application/json'
                }
            })
            console.log(data);

            // localStorage.setItem('user', JSON.stringify(data.user))
            toast.success(data.message);
            router.push("/")
            // window.location.reload();
            setLoading(false)
        } catch (error: any) {
            setLoading(false)
            toast.error(error?.response?.data?.message || 'There is an error');
            console.error(error);
        }
    })


    return (
        <form onSubmit={onSubmit} className='w-full space-y-5'>
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
                type="password"
                placeholder='Password'
                className={clsx(
                    'p-2 rounded-md w-full border outline-none focus:border-blue-500 placeholder:text-sm',
                    { 'border-red-500 focus:border-red-500': errors?.password?.message }
                )}
                {...register('password', { required: 'The password is required' })}
            />
            <ErrorMsg message={errors.password?.message as string} />
            <button
                disabled={!isValid || loading}
                className='w-full bg-blue-500 disabled:bg-blue-400 text-sm text-white p-2 rounded-md flex justify-center items-center'>
                {loading ? <LoadingIcon className='animate-spin w-5 h-5' /> : "Sign In"}
            </button>
        </form>
    )
}

export default SignInForm