import { userType } from '@/types/userTypes'
import { create } from 'zustand'

export type familyState = {
    families: userType[]
}

export type UserActions = {
    setFamilies: (families: userType[]) => void
    addFamily: (newFamily: userType) => void
    updateFamily: (id: string, updatedFields: Partial<userType>) => void
    removeFamily: (id: string) => void
    clearFamilies: () => void
}

export type familyStore = familyState & UserActions

// Use `create` instead of `createStore`
export const useFamilyStore = create<familyStore>()((set) => ({
    families: [],

    setFamilies: (families) => set({ families }),

    addFamily: (newFamily) =>
        set((state) => ({
            families: [...state.families, newFamily],
        })),

    updateFamily: (id, updatedFields) =>
        set((state) => ({
            families: state.families.map((user) =>
                user.id === id ? { ...user, ...updatedFields } : user
            ),
        })),

    removeFamily: (id) =>
        set((state) => ({
            families: state.families.filter((user) => user.id !== id),
        })),

    clearFamilies: () => set({ families: [] }),
}))