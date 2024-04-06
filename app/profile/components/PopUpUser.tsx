import Link from 'next/link'
import React, { useState } from 'react'
import DeleteAccount from './DeleteAccount';
interface props {
    setOpen: React.Dispatch<React.SetStateAction<boolean>>,
    name: string,
    role: string,
}
const PopUpUser: React.FC<props> = ({ setOpen, name, role }) => {
    const [openDeleteAccount, setOpenDeleteAccount] = useState(false);
    const handleClosePopup = () => {
        setOpen(false)
        document.body.style.overflowY = 'auto'
    }

    return (
        <div className='fixed w-full h-full left-0 top-0 bg-black/50 z-50 flex justify-center items-center px-5'>
            <ul className='bg-white overflow-hidden rounded-xl w-full sm:w-[450px] z-50'>
                <li className='w-full text-center text-sm border-b-[1.5px] border-black/50 text-black/95'>
                    <Link
                        onClick={handleClosePopup}
                        href={`${role == 'admin' ? 'teacher' : role}/edit`}
                        className='w-full block py-[17px] font-medium'
                    >
                        Edit profile
                    </Link>
                </li>
                <li className='w-full text-center text-sm border-b-[1.5px] border-black/50 text-black/95'>
                    <Link
                        onClick={handleClosePopup}
                        href={`${role == 'admin' ? 'teacher' : role}/rest-password`}
                        className='w-full block py-[17px] font-medium'
                    >
                        Rest password
                    </Link>
                </li>
                <li className='w-full text-center text-sm border-b-[1.5px] border-black/50 text-red-500'>
                    <button
                        onClick={() => {
                            setOpenDeleteAccount(true)
                        }}
                        className='w-full block py-[17px]'
                    >
                        Delete account
                    </button>
                </li>
                <li className='w-full text-center text-sm border-b-[1.5px] border-black/50 text-black/95'>
                    <button
                        onClick={handleClosePopup}
                        className='w-full block py-[17px]'
                    >
                        Cancel
                    </button>
                </li>
            </ul>
            {
                openDeleteAccount &&
                <DeleteAccount
                    name={name}
                    setOpen={setOpenDeleteAccount}
                    role={role}
                />
            }
            <div onClick={handleClosePopup} className='w-full h-full fixed left-0 top-0' />
        </div >
    )
}

export default PopUpUser