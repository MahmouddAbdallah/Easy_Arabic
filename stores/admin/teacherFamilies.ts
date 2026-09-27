import { userType } from '@/types/userTypes'
import { create } from 'zustand'

export type TeacherFamilyState = {
    teacherFamilies: userType[]
}

export type UserActions = {
    setTeacherFamilies: (teacherFamilies: userType[]) => void
    addTeacherFamily: (newTeacherFamily: userType) => void
    updateTeacherFamily: (id: string, updatedFields: Partial<userType>) => void
    removeTeacherFamily: (id: string) => void
    clearTeacherFamilies: () => void
}

export type TeacherFamilyStore = TeacherFamilyState & UserActions

// Use `create` instead of `createStore`
export const useTeacherFamilyStore = create<TeacherFamilyStore>()((set) => ({
    teacherFamilies: [],

    setTeacherFamilies: (teacherFamilies) => set({ teacherFamilies }),

    addTeacherFamily: (newTeacherFamily) =>
        set((state) => ({
            teacherFamilies: [...state.teacherFamilies, newTeacherFamily],
        })),

    updateTeacherFamily: (id, updatedFields) =>
        set((state) => ({
            teacherFamilies: state.teacherFamilies.map((user) =>
                user.id === id ? { ...user, ...updatedFields } : user
            ),
        })),

    removeTeacherFamily: (id) =>
        set((state) => ({
            teacherFamilies: state.teacherFamilies.filter((user) => user.id !== id),
        })),

    clearTeacherFamilies: () => set({ teacherFamilies: [] }),
}))