'use client'
import Navbar from '@/components/Navbar/Navbar'
import { firebaseClientDBRealTime } from '@/lib/config/firebase-client'
import { userType } from '@/types/userTypes'
import { onDisconnect, onValue, ref, set } from 'firebase/database'
import { serverTimestamp } from 'firebase/firestore'
import { usePathname } from 'next/navigation'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface AppContextValue {
    user: userType | null | undefined
    setUser: (user: userType | null) => void
}
const AUTH_PAGES = ['sign', 'forgot-password', 'reset-password', 'verify-email', 'change-password']


const ProviderAppContext = createContext<AppContextValue | undefined>(undefined)

const AppProvider = ({ children, userData }: { children: ReactNode; userData?: userType | null | undefined }) => {
    const pathname = usePathname();
    const [user, setUser] = useState<userType | null>(userData ?? null)

    useEffect(() => {
        if (!user?.id) return
        const userStatusRef = ref(firebaseClientDBRealTime, `/status/${user.id}`)
        const connectedRef = ref(firebaseClientDBRealTime, '.info/connected')

        const unsubscribe = onValue(connectedRef, (snap) => {
            if (snap.val() === false) return
            onDisconnect(userStatusRef)
                .set({ state: 'offline', last_changed: serverTimestamp() })
                .then(() => {
                    set(userStatusRef, { state: 'online', last_changed: serverTimestamp() })
                })
                .catch((err) => console.error('Presence error:', err))
        })
        return () => unsubscribe()
    }, [user?.id])

    return (
        <ProviderAppContext.Provider
            value={{ user, setUser }}
        >
            <div>
                {!AUTH_PAGES.some((page) => pathname.includes(page)) &&
                    !pathname.includes('chat') &&
                    !pathname.includes('dashboard') &&
                    <Navbar />
                }
                {children}
            </div>
        </ProviderAppContext.Provider>
    )
}

const useAppContext = () => {
    const context = useContext(ProviderAppContext)
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider')
    }
    return context
}

export { AppProvider, useAppContext }
export default ProviderAppContext