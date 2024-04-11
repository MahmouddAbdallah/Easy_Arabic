'use client'
import React, { useState } from 'react'
import SearchFamily from '../../component/SearchFamily'
import { useForm } from 'react-hook-form'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { LoadingIcon } from '@/app/component/icons'
import { useAppContext } from '@/app/context/appContext'

const LessonForm = () => {
    const { register, handleSubmit, setValue, reset } = useForm()
    const [status, setStatus] = useState("")
    const [keyword, setKeyword] = useState('')
    const [loading, setLoading] = useState(false)
    const context = useAppContext()

    const router = useRouter();
    const onSubmit = handleSubmit(async (formData) => {
        try {
            setLoading(true)
            const { data } = await axios.post('/api/lesson', { ...formData })
            toast.success(data.message as string);
            reset();
            setLoading(false)
            router.push("/")
            context?.setUpdateLesson(!context?.updateLesson)
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an error');
            console.error(error);
        }

    })
    return (
        <form onSubmit={onSubmit} className='w-full sm:w-[450px] md:w-[550px] lg:w-[650px] space-y-5 bg-white p-5 rounded-md'>
            <div className='flex flex-col gap-5'>
                <label className='space-y-2'>
                    <span className='text-sm text-black/80 font-semibold'>Search about a family:</span>
                    <SearchFamily
                        keyword={keyword}
                        setKeyword={setKeyword}
                        setValue={setValue}
                        placeholder='Family Name...'
                        className='border w-full rounded-md py-2 px-3 outline-none placeholder:text-sm'
                    />
                </label>
                <label className='space-y-2'>
                    <span className='text-sm text-black/80 font-semibold'>Student Name:</span>
                    <input
                        {...register('student', { required: 'Student name' })}
                        type='text'
                        placeholder='Student Name...'
                        className='border w-full rounded-md py-2 px-3 outline-none placeholder:text-sm'
                    />
                </label>
                <div className='space-y-2 w-full'>
                    <span className='block text-sm text-black/80 font-semibold'>Student Status:</span>
                    <div className='flex gap-5'>
                        <label className='w-full bg-gray-100 p-3 flex items-center gap-3 rounded-md'>
                            <input type="radio"
                                value="Attended"
                                id="Attended"
                                {...register("status", { required: 'Attended or not' })}
                                checked={status === "Attended"}
                                onChange={(e) => setStatus(e.target.value as string)}
                                className='w-5 h-5'
                            />
                            <span className='text-xs text-black/80 font-semibold'>Attended</span>
                        </label>
                        <label className='w-full bg-gray-100 p-3 flex items-center gap-3 rounded-md'>
                            <input
                                type='radio'
                                {...register("status", { required: 'Absent or not' })}
                                value="Absent"
                                id="Absent"
                                checked={status === "Absent"}
                                onChange={(e) => setStatus(e.target.value as string)}
                                className='w-5 h-5'
                            />
                            <span className='text-xs text-black/80 font-semibold'>Absent</span>
                        </label>
                    </div>
                </div>
                <label className='space-y-2'>
                    <span className='text-sm text-black/80 font-semibold'>Duration:</span>
                    <select
                        {...register('duration', { required: 'Please enter a duration' })}
                        className='border w-full rounded-md py-2 px-3 outline-none placeholder:text-sm'
                    >
                        <option value="" >Choose</option>
                        <option value="15" >15</option>
                        <option value="30" >30</option>
                        <option value="45" >45</option>
                        <option value="60" >60</option>
                        <option value="75" >75</option>
                        <option value="90" >90</option>
                        <option value="120" >120</option>
                    </select>
                </label>
                <label className='space-y-2'>
                    <span className='text-sm text-black/80 font-semibold'>Teacher reward:</span>
                    <input
                        {...register('TeacherReward')}
                        type='text'
                        placeholder='Teacher reward'
                        className='border w-full rounded-md py-2 px-3 outline-none placeholder:text-sm'
                    />
                </label>
                <label className='space-y-2'>
                    <span className='text-sm text-black/80 font-semibold'>Class date</span>
                    <input
                        {...register("classDate", { required: 'Please select a date' })}
                        type='date'
                        placeholder='Class date'
                        className='border w-full rounded-md py-2 px-3 outline-none placeholder:text-sm'
                    />
                </label>
                <button
                    disabled={loading}
                    className='bg-blue-500 disabled:bg-blue-300 py-2 rounded-md text-white text-sm flex justify-center'
                >
                    {loading ? <LoadingIcon className='animate-spin w-5 h-5' /> : "Add class"}
                </button>
            </div>
        </form>
    )
}

export default LessonForm