import { userType } from '@/types/userTypes'
import { create } from 'zustand'

export interface TeacherFamilyType {
    id: string;
    family: Partial<userType>;
    createdAt: Temporal.Instant
}

export type TeacherFamilyState = {
    teacherFamilies: TeacherFamilyType[]
}

export type UserActions = {
    setTeacherFamilies: (teacherFamilies: TeacherFamilyType[]) => void
    addTeacherFamily: (newTeacherFamily: TeacherFamilyType) => void
    updateTeacherFamily: (id: string, updatedFields: Partial<TeacherFamilyType>) => void
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