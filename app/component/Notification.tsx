import { useState } from "react"
import { NotificationIcon } from "./icons"
import { useAppContext } from "../context/appContext"

const Notification = () => {
    const [open, setOpen] = useState(false)
    const context = useAppContext()
    return (
        <div className="relative">
            <button onClick={() => setOpen(!open)}>
                <NotificationIcon className="w-6 h-6 fill-gray-800" />
            </button>
            {open &&
                <div className="absolute top-10 py-5 px-5 bg-white z-50 rounded-xl">

                </div>
            }
        </div>
    )
}

export default Notification