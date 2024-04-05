import { CloseIcon } from '@/app/component/icons'
import Link from 'next/link'
import React from 'react'
interface props {
    open: boolean,
    setOpen: React.Dispatch<React.SetStateAction<boolean>>,
    name: string,
    role: string,
}
const PopUpUser: React.FC<props> = ({ open, setOpen, name, role }) => {
    const handleClosePopup = () => {
        setOpen(false)
        document.body.style.overflowY = 'auto'
    }
    return (
        <div className='fixed w-full h-full left-0 top-0 bg-black/50 z-50 flex justify-center items-center'>
            <div onClick={handleClosePopup} className='w-full h-full fixed left-0 top-0' />
            <div className="px-5 w-full lg:flex justify-center">
                <div className='bg-white overflow-hidden rounded-xl z-50 w-full lg:w-[450px]'>
                    <div className='bg-gray-200 flex items-center justify-end px-2 py-2'>
                        <button onClick={handleClosePopup}>
                            <CloseIcon className='w-6 h-6 cursor-pointer ' />
                        </button>
                    </div>
                    <div className='space-y-5'>
                        <div className='px-4 pt-5'>
                            <span className='text-sm'>Do you want to eidt &ldquo;<span className='font-semibold'>{name}</span>&ldquo; profile ?</span>
                        </div>
                        <div className='border-t '>
                            <div className='float-right space-x-3 p-3'>
                                <button onClick={handleClosePopup} className='px-5 py-2 font-medium bg-gray-400 text-xs text-white  rounded-md'>Cancel</button>
                                <Link href={`${role == 'admin' ? 'teacher' : role}/edit`} onClick={handleClosePopup} className='px-5 py-2 font-medium bg-blue-500 text-xs text-white  rounded-md'>Edit</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PopUpUser