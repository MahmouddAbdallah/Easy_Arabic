import { useState } from "react"
import { NotificationIcon, ThreeDot } from "./icons"
import { useAppContext } from "../context/appContext"
import useClickOutside from "../hooks/useClickOutside"
import axios from "axios"
import clsx from "clsx"
import { readableFormatMonthTime as formatDate } from "@/lib/function"
import Link from "next/link"
import { toast } from "react-hot-toast"

const Notification = () => {
    const [open, setOpen] = useState(false)
    const [threeDot, setThreeDot] = useState('')
    const context = useAppContext()
    const elementRef = useClickOutside(() => {
        setOpen(false)
        setThreeDot("")
        context?.setNotification((prev: any) => {
            const data = prev?.data?.map((item: any) => ({
                ...item,
                isRead: true
            }));
            return { ...prev, data: data };
        })
    })

    const currentDate = new Date()?.toISOString()?.slice(0, 10);

    const ReadAllNotification = async () => {
        try {
            setOpen(!open)
            await axios.put('/api/notification');
            context?.setNotification({ ...context?.notification, isRead: 0 })
        } catch (error) {
            console.error(error);
        }
    }

    const deleteNotification = async (id: string) => {
        try {
            const { data } = await axios.delete(`/api/notification/${id}`)
            context?.setNotification((prev: any) => {
                const data = prev?.data?.filter((item: any) => item?.id != id)
                return { ...prev, data: data }
            })
            toast.success(data.message)
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an error');
            console.error(error);
        }
    }

    const readAll = () => {
        context?.setNotification((prev: any) => {
            const data = prev?.data?.map((item: any) => ({
                ...item,
                isRead: true
            }));
            return { ...prev, data: data };
        })
    }
    const deleteAll = async () => {
        try {
            const { data } = await axios.delete(`/api/notification`)
            context?.setNotification({ data: [] })
            toast.success(data.message)
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an error');
            console.error(error);
        }
    }

    return (
        <>
            <div ref={elementRef} className="relative flex items-center">
                <button onClick={ReadAllNotification} className="relative">
                    <NotificationIcon className="w-5 lg:w-6 h-5 lg:h-6 fill-gray-800 mt-1" />
                    {
                        context?.notification?.isRead > 0 &&
                        <span className="block absolute bg-blue-500 rounded-full text-sm text-white w-5 h-5 -right-2 -top-2">
                            {context?.notification?.isRead}
                        </span>
                    }
                </button>
                <div>
                    {open &&
                        <div className="absolute top-10 border bg-white z-50 rounded-b-lg w-80 md:w-96 -right-20 lg:-right-20  overflow-y-auto min-h-[50svh] max-h-[80svh]">
                            {context?.notification?.data?.length ?
                                <>
                                    <div className="flex border-b">
                                        <button onClick={readAll} className="w-full py-3 text-sm text-blue-500 hover:bg-blue-50 hover:font-medium duration-150 border-r-2">Read All</button>
                                        <button onClick={deleteAll} className="w-full py-3 text-sm text-red-500 hover:bg-red-50 hover:font-medium duration-150">Delete All</button>
                                    </div>
                                    <div>
                                        {context?.notification?.data?.map((item: any) => {
                                            const deleteLesson = item?.type?.split('family')
                                            return (
                                                <div key={item.id}>
                                                    <div className={clsx(
                                                        "border-b-2 py-3 px-3 ",
                                                        { 'bg-blue-100 border-white': !(item?.isRead) }
                                                    )}>
                                                        <div className="flex justify-between">
                                                            <div className="flex gap-2 md:gap-3">
                                                                <div>
                                                                    <div className='text-xs font-semibold bg-teal-500 text-white w-8 h-8 flex justify-center items-center rounded-full'>
                                                                        {item?.user?.name?.split("")[0]}
                                                                    </div>
                                                                </div>
                                                                <div className="leading-[.7px]">
                                                                    <Link href={`/profile/${item?.user?.id}/teacher`}
                                                                        className="text-xs md:text-sm -space-y-1 hover:text-blue-500 hover:underline duration-100">
                                                                        <span className="font-medium">{item?.user?.name}</span>
                                                                        <span className="text-[10px] block">{item?.user?.email}</span>
                                                                    </Link>
                                                                    <span className="text-[10px] leading-tight font-medium">
                                                                        {deleteLesson ?
                                                                            <span>{deleteLesson[0]}
                                                                                <Link href={`/profile/${deleteLesson[2]?.replace(/\s/g, "")}/family`}
                                                                                    className="font-semibold text-black hover:text-blue-500 underline duration-100"
                                                                                >
                                                                                    {deleteLesson[1]}
                                                                                </Link>
                                                                            </span> :
                                                                            item?.type
                                                                        }
                                                                        {item?.lesson?.family?.name
                                                                            && <>
                                                                                &#160;for family&#160;
                                                                                <Link href={`/profile/${item?.lesson?.family?.id}/family`}
                                                                                    className="font-semibold text-black hover:text-blue-500 underline duration-100"
                                                                                >
                                                                                    {item?.lesson?.family?.name}
                                                                                </Link>
                                                                            </>
                                                                        }
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col items-end">
                                                                <button onClick={() => { setThreeDot(threeDot == item.id ? "" : item.id) }}>
                                                                    <ThreeDot className="w-5 h-5" />
                                                                </button>
                                                                <span className="text-[9px] font-medium whitespace-nowrap text-right">
                                                                    {formatDate(item?.createdAt as string).month == currentDate ? "Today" : formatDate(item?.createdAt as string).month}
                                                                    <span className="block">
                                                                        at {formatDate(item?.createdAt as string).time}
                                                                    </span>
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {
                                                            item?.id == threeDot &&
                                                            <button onClick={() => {
                                                                deleteNotification(item.id);
                                                            }} className=" w-full text-xs text-red-500 pt-2 underline font-bold hover:font-extrabold duration-150">
                                                                Delete notification
                                                            </button>
                                                        }
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </>
                                :
                                <div className="font-medium flex justify-center items-center min-h-[50svh] text-center">
                                    There is no notification yet.
                                </div>
                            }
                        </div>
                    }
                </div>
            </div>
        </>
    )
}

export default Notification