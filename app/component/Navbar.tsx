'use client'
import { usePathname } from "next/navigation"
import { useAppContext } from "../context/appContext"
import Link from "next/link"
import { useState } from "react"
import axios from "axios"
import { toast } from "react-hot-toast"
import useClickOutside from "../hooks/useClickOutside"
import clsx from "clsx"
import { LogoIcon } from "./icons"
const Navbar = () => {
    const pathname = usePathname()
    const context = useAppContext()
    const [open, setOpen] = useState(false)

    const logout = async () => {
        try {
            const { data } = await axios.get('/api/logout')
            toast.success(data?.message)
            localStorage.clear();
            window.location.reload()
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an error');
            console.error(error);
        }
    }

    const elementRef = useClickOutside(() => setOpen(false))
    return (
        !pathname.includes("sign") &&
        <nav className="bg-white p-container shadow-md">
            <div className="flex items-center justify-between px-5 py-5">
                <div className="flex items-center">
                    <Link href={'/'} className="absolute">
                        <LogoIcon className="w-11 h-11" />
                    </Link>
                </div>
                <div className="flex items-center md:gap-7">
                    <ul className="flex gap-5">
                        <li className={clsx(
                            "hidden md:block font-semibold",
                            { 'text-blue-500': pathname == "/" }
                        )}>
                            <Link href={'/'}>Home</Link>
                        </li>
                        {
                            (context?.user?.role == 'teacher' || context?.user?.role == 'admin') &&
                            <li className={clsx(
                                "hidden md:block font-semibold",
                                { 'text-blue-500': pathname.includes('lesson') }
                            )}>
                                <Link href={'/lesson'}>Add Class</Link>
                            </li>
                        }
                        {
                            (context?.user?.role == 'admin') &&
                            <li className={clsx(
                                "hidden md:block font-semibold",
                                { 'text-blue-500': pathname.includes('dashboard') }
                            )}>
                                <Link href={'/dashboard'} className="w-full py-1">Dashboard</Link>
                            </li>
                        }
                        {
                            (context?.user?.role == 'admin') &&
                            <li className={clsx(
                                "hidden md:block font-semibold",
                                { 'text-blue-500': pathname.includes('Sign up') }
                            )}>
                                <Link href={'/sign-up'} className="w-full py-1">Sign up</Link>
                            </li>
                        }
                    </ul>
                    {
                        context?.user?.name ?
                            <div ref={elementRef} className="relative">
                                <button onClick={() => setOpen(!open)} className="flex items-center gap-2 md:bg-blue-50 px-3 py-[6px] rounded-md relative">
                                    <div className="text-xs font-semibold bg-blue-500 text-white w-6 h-6 flex justify-center items-center rounded-full">{context?.user?.name?.split('')[0]}</div>
                                    <span className="text-sm hidden md:block">{context?.user?.name}</span>
                                </button>
                                {
                                    open &&
                                    <ul className="absolute bg-white w-36 md:w-full border top-9 -right-2 md:right-0 rounded-b-md z-50 ">
                                        <li><Link href={'/'} className="w-full flex uppercase md:hidden px-5 py-3 font-medium text-sm text-center border-b">Home</Link></li>
                                        {
                                            (context?.user?.role == 'teacher' || context?.user?.role == 'admin') &&
                                            <li><Link href={'/lesson'} className="w-full flex uppercase md:hidden px-5 py-3 font-medium text-sm text-center border-b">Lesson</Link></li>
                                        }
                                        {
                                            (context?.user?.role == 'admin') &&
                                            <li><Link href={'/dashboard'} className="w-full flex uppercase md:hidden px-5 py-3 font-medium text-sm text-center border-b">Dsahboard</Link></li>
                                        }
                                        {
                                            (context?.user?.role == 'admin') &&
                                            <li><Link href={'/sign-up'} className="w-full flex uppercase md:hidden px-5 py-3 font-medium text-sm text-center border-b">sign-up</Link></li>
                                        }
                                        <li><button onClick={logout} className="w-full flex uppercase px-5 py-3 font-medium text-sm text-center border-b ">logout</button></li>
                                    </ul>
                                }
                            </div>
                            :
                            <div>
                                <Link href={'/sign-in'} className="text-xs font-semibold bg-blue-500 text-white px-5 py-2 rounded-md">Sign In</Link>
                            </div>
                    }
                </div>
            </div>
        </nav>
    )
}

export default Navbar