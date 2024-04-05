import React, { use, useState } from 'react'
import { useForm } from 'react-hook-form';
import SearchFamily from '../lesson/components/SearchFamily';
import { CloseIcon, LoadingIcon } from './icons';
import { toast } from 'react-hot-toast';
import axios from 'axios';
type editTypes = {
    family: { name: string },
    student: string,
    status: string,
    classDate: string,
    month: string,
    duration: string,
    TeacherReward: string
}

interface props {
    edit: any,
    open: boolean,
    setEdit: React.Dispatch<React.SetStateAction<editTypes>>
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}
const EditRowTable: React.FC<props> = ({ edit, setEdit, setOpen, open }) => {
    const { register, setValue, handleSubmit } = useForm();
    const [keyword, setKeyword] = useState(edit.family.name)
    const [status, setStatus] = useState(edit.status)
    const [loadDelete, setLoadDelete] = useState(false)
    const [loadUpdate, setLoadUpdate] = useState(false)

    const onSubmit = handleSubmit(async (formData) => {
        try {
            setLoadUpdate(true)
            const { data } = await axios.put(`/api/lesson/${edit.id}`, { ...formData })
            toast.success(data.message)
            window.location.reload()
            setLoadUpdate(false)
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an error');
            console.error(error);
        }

    })

    const deleteRow = async () => {
        try {
            setLoadDelete(true)
            const { data } = await axios.delete(`/api/lesson/${edit.id}`)
            toast.success(data.message)
            window.location.reload()
            setLoadDelete(false)
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an error');
            console.error(error);
        }
    }
    return (
        <div className='fixed bg-black/20 w-full h-full left-0 top-0 flex justify-center items-center z-50 px-5'>
            <div onClick={() => {
                setOpen(false)
                document.body.style.overflowY = 'auto'
            }} className='w-full h-full fixed left-0 top-0' >
                <div className='float-end p-10 lg:px-44 text-white'>
                    <CloseIcon className='w-8 h-8 cursor-pointer' />
                </div>
            </div>
            <div
                className='w-full md:w-[500px] h-[90%] overflow-y-auto hide-scrollbar py-10 bg-white rounded-md z-50'
            >
                <form onSubmit={onSubmit} className='px-5'>
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
                            <span className='text-sm text-black/80 font-semibold'>Student Name :</span>
                            <input
                                type="text"
                                {...register('student')}
                                value={edit.student}
                                onChange={(e) => setEdit({ ...edit, student: e.target.value })}
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
                                        {...register("status")}
                                        checked={status === "Attended"}
                                        onChange={(e) => setStatus(e.target.value as string)}
                                        className='w-5 h-5'
                                    />
                                    <span className='text-xs text-black/80 font-semibold'>Attended</span>
                                </label>
                                <label className='w-full bg-gray-100 p-3 flex items-center gap-3 rounded-md'>
                                    <input
                                        type='radio'
                                        {...register("status")}
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
                                {...register('duration')}
                                value={edit.duration}
                                onChange={(e) => setEdit({ ...edit, duration: e.target.value })}
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
                                value={edit.TeacherReward}
                                onChange={(e) => setEdit({ ...edit, TeacherReward: e.target.value })}
                                type='text'
                                placeholder='Teacher reward'
                                className='border w-full rounded-md py-2 px-3 outline-none placeholder:text-sm'
                            />
                        </label>
                        <label className='space-y-2'>
                            <span className='text-sm text-black/80 font-semibold'>Class date</span>
                            <input
                                {...register("classDate")}
                                value={edit.classDate}
                                onChange={(e) => setEdit({ ...edit, classDate: e.target.value })}
                                type='date'
                                placeholder='Class date'
                                className='border w-full rounded-md py-2 px-3 outline-none placeholder:text-sm'
                            />
                        </label>
                        <div className='flex gap-3'>
                            <button
                                disabled={loadDelete || loadUpdate}
                                onClick={deleteRow} className='w-full bg-red-500 disabled:bg-red-400 py-2 rounded-md text-white text-sm flex justify-center items-center'>
                                {loadDelete ? <LoadingIcon className='animate-spin w-5 h-5' /> : "Remove"}
                            </button>
                            <button
                                disabled={loadDelete || loadUpdate}
                                className='w-full bg-blue-500 disabled:bg-blue-400 py-2 rounded-md text-white text-sm flex justify-center items-center'>
                                {loadUpdate ? <LoadingIcon className='animate-spin w-5 h-5' /> : "Update"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default EditRowTable