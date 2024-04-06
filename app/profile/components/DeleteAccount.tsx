'use client'
import { CloseIcon, WarnIcon } from '@/app/component/icons'
import axios from 'axios'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

interface props {
    role: string,
    name: string,
    setOpen: React.Dispatch<React.SetStateAction<boolean>>
}
const DeleteAccount: React.FC<props> = ({ role, setOpen, name }) => {
    const { id } = useParams()
    const router = useRouter();
    const onSubmit = (async () => {
        try {
            const { data } = await axios.delete(`/api/${role === "admin" ? 'teacher' : role}/${id}`)
            toast.success(data.message);
            setOpen(false)
            document.body.style.overflowY = 'auto'
            router.push('/dashboard')
            setTimeout(() => {
                document.location.reload()
            }, 2000)
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an error');
            console.error(error);
        }
    })
    const handleClosePopup = () => {
        setOpen(false)
    }
    return (
        <div className='fixed w-full h-full left-0 top-0 bg-black/60 z-[999] flex justify-center items-center px-10'>
            <div className='bg-white overflow-hidden rounded-xl z-50 w-full sm:w-[400px]'>
                <div className='flex items-center justify-between px-2 py-2'>
                    <div className='flex items-center gap-1'>
                        <WarnIcon className='w-5 h-5 fill-yellow-300' />
                        <span className='text-xs font-semibold'>Warn</span>
                    </div>
                    <button onClick={handleClosePopup}>
                        <CloseIcon className='w-5 h-5 cursor-pointer ' />
                    </button>
                </div>
                <div className='border-y border-black/30'>
                    <div className='px-4 py-4 space-y-4'>
                        <span className='text-sm font-medium'>Do you want to delete &ldquo;<span className='font-semibold'>{name}</span>&ldquo; profile ?</span>
                        <div className='space-y-1'>
                            <span className='text-sm font-semibold block'>Hint :</span>
                            <span className='text-xs block font-medium'>This action will delete all lessons that related to this profile..</span>
                        </div>
                    </div>
                    <div>
                        <div className='float-right space-x-3 px-3 py-2'>
                            <button
                                onClick={handleClosePopup}
                                className='px-5 py-2 font-medium bg-gray-100 text-xs text-black border border-black/20  rounded-md'
                            >
                                Cancel
                            </button>
                            <button onClick={onSubmit} className='px-5 py-2 font-medium bg-red-500 text-xs text-white  rounded-md'>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div onClick={handleClosePopup} className='w-full h-full fixed left-0 top-0' />
        </div>
    )
}

export default DeleteAccount