import { useState } from "react"
import { NotificationIcon, ThreeDot } from "./icons"
import { useAppContext } from "../context/appContext"
import useClickOutside from "../hooks/useClickOutside"
import axios from "axios"
import clsx from "clsx"

const Notification = () => {
    const [open, setOpen] = useState(false)
    const context = useAppContext()
    const elementRef = useClickOutside(() => setOpen(false))
    const ReadNotification = async () => {
        try {
            setOpen(!open)
            await axios.put('/api/notification');
            context?.setNotification({ ...context?.notification, isRead: 0 })
        } catch (error) {
            console.error(error);
        }
    }
    console.log(context?.notification);

    return (
        <div ref={elementRef} className="relative flex items-center">
            <button onClick={ReadNotification} className="relative">
                <NotificationIcon className="w-6 h-6 fill-gray-800" />
                {
                    context?.notification?.isRead != 0 &&
                    <span className="block absolute bg-red-500 rounded-full text-sm text-white w-5 h-5 -right-2 -top-2">
                        {context?.notification?.isRead}
                    </span>
                }
            </button>
            {open &&
                <div className="absolute top-10 bg-white z-50 rounded-xl w-80 md:w-96 -right-20 lg:-right-20  overflow-y-auto max-h-[80svh]">
                    {context?.notification?.data?.map((item: any) => {
                        console.log(item);

                        return (
                            <div key={item.id}>
                                <div className={clsx(
                                    "border-b-2 py-3 px-3 ",
                                    { 'bg-blue-100': !(item?.isRead) }
                                )}>
                                    <div className="flex justify-between">
                                        <div className="flex gap-2 md:gap-3">
                                            <div>
                                                <div className='text-xs font-semibold bg-teal-500 text-white w-8 h-8 flex justify-center items-center rounded-full'>
                                                    {item?.user?.name?.split("")[0]}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs md:text-sm -space-y-1">
                                                    <span className="font-medium">{item?.user?.name}</span>
                                                    <span className="block text-[10px]">{item?.user?.email}</span>
                                                </div>
                                                <span className="flex whitespace-nowrap gap-1 text-[10px]">
                                                    <span className="block ">{item.type}</span>
                                                    {item?.lesson?.family?.name
                                                        && <span className=" block space-x-1">
                                                            <span>
                                                                For family
                                                            </span>
                                                            <span className="font-semibold text-black">
                                                                {item?.lesson?.family?.name}
                                                            </span>
                                                        </span>
                                                    }
                                                </span>
                                            </div>
                                        </div>
                                        <div className="">
                                            {/* <ThreeDot className="w-5 h-5" /> */}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            }
        </div>
    )
}

export default Notification