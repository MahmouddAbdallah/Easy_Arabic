'use client'
import axios from 'axios'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
interface UserInterface {
    id: string,
    name: string,
    email: string,
    phone: string,
    password: string,
    role: string
}
type AppContextTypes = {
    user: UserInterface | null,
    setUser: React.Dispatch<React.SetStateAction<UserInterface | null>>,
    data: any,
    notification: any
}
const appContext = createContext<AppContextTypes | undefined>(undefined);

const AppContextProvider = ({ children }: { children: React.ReactNode }) => {

    const [user, setUser] = useState<UserInterface | null>(null)
    const [data, setData] = useState([]);
    const [notification, setNotification] = useState([]);

    const fetchUser = useCallback(() => {
        const userData = localStorage?.getItem('user');
        if (userData) {
            setUser(JSON.parse(userData));
        }
    }, [])

    useEffect(() => {
        fetchUser()
    }, [fetchUser]);

    const fetchDataTeacher = useCallback(async () => {
        try {
            const { data } = await axios.get(`/api/lesson/teacher/${user?.id}`)
            setData(data.tables);
        } catch (error) {
            console.error(error);
        }
    }, [user?.id])

    useEffect(() => {
        if ((user?.role == 'teacher' || user?.role == 'admin')) {
            fetchDataTeacher();
        }
    }, [user?.role, fetchDataTeacher])

    const fetchDataFamily = useCallback(async () => {
        try {
            const { data } = await axios.get(`/api/lesson/family/${user?.id}`)
            setData(data.tables);
        } catch (error) {
            console.error(error);
        }
    }, [user?.id])

    useEffect(() => {
        if (user?.role == 'family') {
            fetchDataFamily();
        }
    }, [user?.role, fetchDataFamily])

    const fetchNotification = useCallback(async () => {
        try {
            const { data } = await axios.get(`/api/notification`)
            setNotification(data.notification);
        } catch (error) {
            console.error(error);
        }
    }, [])
    useEffect(() => {
        if ((user?.role == 'admin')) {
            fetchNotification()
        }
    }, [fetchNotification, user?.role])
    return (
        <appContext.Provider value={{ user, setUser, data, notification }}>
            {children}
            <Toaster position='bottom-right' toastOptions={{ 'duration': 3000 }} />
        </appContext.Provider>
    )
}
export const useAppContext = () => {
    return (
        useContext(appContext)
    )
}
export default AppContextProvider