'use client'
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
}
const appContext = createContext<AppContextTypes | undefined>(undefined);

interface appContextProps {
    children: React.ReactNode
}
const AppContextProvider: React.FC<appContextProps> = ({ children }) => {
    const [user, setUser] = useState<UserInterface | null>(null)
    const fetchUser = useCallback(() => {
        const userData = localStorage?.getItem('user');
        if (userData) {
            setUser(JSON.parse(userData));
        }
    }, [])
    useEffect(() => {
        fetchUser()
    }, [fetchUser]);
    return (
        <appContext.Provider value={{ user, setUser }}>
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