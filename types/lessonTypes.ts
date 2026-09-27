import { userType } from "./userTypes"

export type LessonType = "id" | "createdAt" | "updatedAt" | "userId" | "student" | "status" | "classDate" | "money" | "duration" | "TeacherReward"
export type LessonStatus = 'Attended' | 'Absent'

export interface Family {
    id?: string
    name?: string
}

export interface LessonData {
    id?: string
    student?: string
    status?: LessonStatus
    duration?: string
    TeacherReward?: number | string
    classDate?: string
    family?: Family
}

export interface LessonItem {
    id: string;
    student?: string;
    family?: Partial<userType>;
    status: string;
    TeacherReward: string;
    duration: string;
    classDate: Date | string;
}