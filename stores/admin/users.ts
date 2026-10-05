import { userType } from '@/types/userTypes'
import { create } from 'zustand'

export type UserState = {
    users: userType[]
    teachers: userType[]
    families: userType[]
}

export type UserActions = {
    setUsers: (users: userType[]) => void
    setTeachers: (teachers: userType[]) => void
    setFamilies: (families: userType[]) => void
    addUser: (newUser: userType) => void
    updateUser: (id: string, updatedFields: Partial<userType>) => void
    removeUser: (id: string) => void
    clearUsers: () => void
}

export type UserStore = UserState & UserActions

// Use `create` instead of `createStore`
export const useUserStore = create<UserStore>()((set) => ({
    users: [],
    teachers: [],
    families: [],

    setUsers: (users) => set({ users }),

    addUser: (newUser) =>
        set((state) => ({
            users: [...state.users, newUser],
        })),

    updateUser: (id, updatedFields) =>
        set((state) => ({
            users: state.users.map((user) =>
                user.id === id ? { ...user, ...updatedFields } : user
            ),
        })),

    removeUser: (id) =>
        set((state) => ({
            users: state.users.filter((user) => user.id !== id),
        })),

    clearUsers: () => set({ users: [] }),

    //Teachers
    setTeachers: (teachers) => set({ teachers }),

    //Families
    setFamilies: (families) => set({ families }),
}))