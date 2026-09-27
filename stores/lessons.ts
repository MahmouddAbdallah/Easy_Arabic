import { LessonItem } from '@/types/lessonTypes'
import { create } from 'zustand'

export type LessonState = {
    lessons: LessonItem[];
    count: number
}

export type UserActions = {
    setLessons: (Lessons: LessonItem[]) => void
    addLesson: (newLesson: LessonItem) => void
    setCount: (count: number) => void
    updateLesson: (id: string, updatedFields: Partial<LessonItem>) => void
    removeLesson: (id: string) => void
    clearLessons: () => void
}

export type LessonStore = LessonState & UserActions

// Use `create` instead of `createStore`
export const useLessonStore = create<LessonStore>()((set) => ({
    lessons: [],
    count: 0,

    setLessons: (lessons) => set({ lessons }),
    setCount: (count) => set({ count }),

    addLesson: (newLesson) =>
        set((state) => ({
            lessons: [...state.lessons, newLesson],
            count: state.count + 1
        })),

    updateLesson: (id, updatedFields) =>
        set((state) => ({
            lessons: state.lessons.map((user) =>
                user.id === id ? { ...user, ...updatedFields } : user
            ),
        })),

    removeLesson: (id) =>
        set((state) => ({
            lessons: state.lessons.filter((user) => user.id !== id),
            count: state.count - 1
        })),

    clearLessons: () => set({ lessons: [] }),
}))