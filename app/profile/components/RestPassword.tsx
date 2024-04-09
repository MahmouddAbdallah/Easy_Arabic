'use client'
import ErrorMsg from '@/app/component/ErrorMsg'
import { LoadingIcon } from '@/app/component/icons'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'

const RestPassword = ({ role, id }: { role: string, id: string, }) => {

    const { register, handleSubmit, watch, formState: { errors, isValid } } = useForm()
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const onSubmit = handleSubmit(async (formData) => {
        try {
            const { data } = await axios.patch(`/api/${role === "admin" ? 'teacher' : role}/password/rest/${id}`, {
                newPassword: formData.newPassword,
            })
            toast.success(data.message);
            router.push(`/profile/${id}/${role === "admin" ? 'teacher' : role}`)
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an error');
            console.error(error);
        }
    })

    return (
        <div className='bg-white shadow rounded-xl py-5 lg:py-10 overflow-hidden flex justify-center'>
            <form className='md:w-[500px] px-5 pt-16 pb-10 rounded-xl lg:border lg:bg-blue-50'>
                <div className='text-center pb-10 text-xl uppercase font-medium'>
                    <span>Change Password</span>
                </div>
                <div className='space-y-5'>
                    <input
                        type="password"
                        placeholder='New Password'
                        {...register('newPassword', { required: 'Please Enter New Password' })}
                        className=' p-2 rounded-md w-full border border-gray-400 disabled:placeholder:text-black/50 placeholder:text-sm outline-none focus:border-blue-500'
                    />
                    <ErrorMsg message={errors.newPassword?.message as string} />
                    <input
                        type="password"
                        placeholder='Confirmation Password'
                        {...register('confirmPassword', {
                            required: 'Please Enter Password',
                            validate: (val) => {
                                if (!val) {
                                    return "Please enter your password again.";
                                } else if (watch('newPassword') != val) {
                                    return "Passwords do not match!";
                                }
                            }
                        })}
                        className=' p-2 rounded-md w-full border border-gray-400 disabled:placeholder:text-black/50 placeholder:text-sm outline-none focus:border-blue-500'
                    />
                    <ErrorMsg message={errors.confirmPassword?.message as string} />
                    <div className='flex gap-5'>
                        <button
                            onClick={onSubmit}
                            disabled={!isValid || loading}
                            className="w-full py-2 rounded-md bg-blue-500 disabled:bg-blue-300 text-white font-semibold"
                        >
                            {loading ? <LoadingIcon className='animate-spin w-5 h-5' /> : "Rest password"}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    )
}

export default RestPassword