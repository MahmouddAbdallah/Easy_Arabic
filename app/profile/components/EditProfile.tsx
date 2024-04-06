'use client'
import axios from 'axios'
import React, { useState } from 'react'
import { toast } from 'react-hot-toast'
interface props {
    user: {
        id: string,
        name: string,
        email: string,
        phone: string,
        role: string
    }
}

const EditProfile: React.FC<props> = ({ user }) => {
    const [userData, setUserData] = useState(user)
    const [edit, setEdit] = useState(false)
    const onSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
        try {
            e.preventDefault();
            const { data } = await axios.put(`/api/${user.role}/${user.id}`, { ...userData })
            setUserData(data.user)
            setEdit(false)
            toast.success(data.message);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an error');
            console.error(error);
        }
    }

    return (
        <div className='space-y-10'>
            <div className='bg-white py-3 px-5 md:flex justify-center lg:py-10 lg:px-10 rounded-xl space-y-10 shadow'>
                <form className='md:w-[500px] px-5 pt-10 pb-5'>
                    <div className='text-center pb-10 text-xl uppercase font-medium'>
                        <span>update</span>
                    </div>
                    <div className='space-y-5'>
                        <input
                            type="text"
                            disabled={!edit}
                            value={userData.name}
                            onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                            className=' p-2 rounded-md w-full border border-gray-400 disabled:text-black/70 outline-none focus:border-blue-500 placeholder:text-black'
                        />
                        <input
                            type="text"
                            disabled={!edit}
                            value={userData.email}
                            onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                            className=' p-2 rounded-md w-full border border-gray-400 disabled:text-black/70 outline-none focus:border-blue-500 placeholder:text-black'
                        />
                        <input
                            type="text"
                            disabled={!edit}
                            value={userData.phone}
                            onChange={(e) => setUserData({ ...userData, phone: e.target.value })}
                            className=' p-2 rounded-md w-full border border-gray-400 disabled:text-black/70 outline-none focus:border-blue-500 placeholder:text-black'
                        />
                        <input
                            type="text"
                            disabled={!edit}
                            value={userData.role}
                            onChange={(e) => setUserData({ ...userData, role: e.target.value })}
                            className=' p-2 rounded-md w-full border border-gray-400 disabled:text-black/70 outline-none focus:border-blue-500 placeholder:text-black'
                        />
                        <div className='flex gap-5'>
                            <button
                                onClick={onSubmit}
                                disabled={!edit}
                                className="w-full py-2 rounded-md bg-blue-500 disabled:bg-blue-300 text-white font-semibold">Save</button>
                            <button
                                disabled={edit}
                                onClick={() => setEdit(true)} className="w-full py-2 rounded-md border-2 border-blue-500 disabled:border-blue-300 disabled:text-black/50 font-semibold">
                                Edit
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default EditProfile