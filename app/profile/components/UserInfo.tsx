'use client';
import { ThreeDot } from '@/app/component/icons'
import PopUpUser from './PopUpUser'
import { useState } from 'react';
interface props {
    user: {
        id: string,
        name: string,
        email: string,
        phone: string,
        role: string
    }
}
const UserInfo: React.FC<props> = ({ user }) => {
    const [open, setOpen] = useState(false)

    const handleOpenPopup = () => {
        setOpen(!open);
        document.body.style.overflowY = 'hidden'
    }

    return (
        <div className='pt-5 pb-10 bg-white lg:px-10 shadow rounded-xl '>
            <div className='px-5 lg:relative '>
                {
                    user?.id && <button
                        onClick={handleOpenPopup}
                        className='float-right bg-gray-200 px-2 py-1 rounded-md lg:absolute lg:right-0 top-3'>
                        <ThreeDot className='w-5 h-5' />
                    </button>
                }
            </div>
            <div className='w-full flex justify-center lg:justify-start items-center'>
                <div className='space-y-4 flex lg:flex-row lg:items-start gap-3 flex-col items-center'>
                    <div className='w-32 h-32 bg-emerald-500 rounded-full flex justify-center items-center'>
                        <span className='text-5xl text-white'>
                            {user?.name?.split("")[0] ? user?.name?.split("")[0] : "D"}
                        </span>
                    </div>
                    <div className='text-center lg:text-left space-y-1 lg:space-y-2'>
                        <h4 className='font-semibold'>{user?.name ? user?.name : "DELETD ACCOUNT"}</h4>
                        <p className='text-sm uppercase font-medium'>{user?.role}</p>
                        <p className='text-sm text-black/70'>{user?.email}</p>
                        <p className='text-sm text-black/70'>{user?.phone}</p>
                    </div>
                </div>
            </div>
            {open &&
                <PopUpUser
                    setOpen={setOpen}
                    name={user?.name}
                    role={user?.role}
                />}
        </div>
    )
}

export default UserInfo