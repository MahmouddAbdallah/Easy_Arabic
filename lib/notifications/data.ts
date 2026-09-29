import { Timestamp } from 'firebase-admin/firestore';
import { serverTimestamp } from 'firebase/firestore';
import {
    UserCheck,
    BookPlus,
    FileEdit,
    Trash2,
    UserPlus,
    GraduationCap,
    CreditCard,
    FileCheck2,
    CalendarDays,
    UserX,
    Users,
    Megaphone,
    LucideIcon,
} from 'lucide-react';

// ==========================================
// 1. TYPES
// ==========================================

export type NotificationType =
    | 'CREATE_ACCOUNT'
    | 'CREATE_LESSON'
    | 'UPDATE_LESSON'
    | 'DELETE_LESSON'
    | 'ASSIGN_TEACHER'
    | 'NEW_STUDENT_ENROLLED'
    | 'PAYMENT_SUCCESS'
    | 'ASSIGNMENT_SUBMITTED'
    | 'EXAM_SCHEDULED'
    | 'ATTENDANCE_ABSENT'
    | 'FAMILY_MEMBER_LINKED'
    | 'ANNOUNCEMENT_PUBLISHED';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface NotificationMetadata {
    lessonId?: string;
    studentId?: string;
    teacherId?: string;
    classId?: string;
    assignmentId?: string;
    examId?: string;
    familyId?: string;
    invoiceId?: string;
    [key: string]: unknown;
}

export interface FirestoreNotificationDoc {
    type: NotificationType;
    title: string;
    body: string;
    iconName: string;
    route: string;
    priority: NotificationPriority;
    isRead: boolean;
    createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
    metadata?: NotificationMetadata;
}

export interface NotificationPayload {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    icon: LucideIcon;
    route: string;
    priority: NotificationPriority;
    isRead: boolean;
    createdAt: string;
    metadata?: NotificationMetadata;
}

// ==========================================
// 2. ICON MAPPER
// ==========================================

export const ICON_MAP: Record<string, LucideIcon> = {
    UserCheck,
    BookPlus,
    FileEdit,
    Trash2,
    UserPlus,
    GraduationCap,
    CreditCard,
    FileCheck2,
    CalendarDays,
    UserX,
    Users,
    Megaphone,
};

// ==========================================
// 3. DYNAMIC TEMPLATES (القوالب الثابتة المتغيرة)
// ==========================================

export interface TemplateParams {
    userName?: string;
    lessonTitle?: string;
    subjectName?: string;
    studentName?: string;
    className?: string;
    teacherName?: string;
    assignmentTitle?: string;
    examTitle?: string;
    examDate?: string;
    amount?: string;
    announcementTitle?: string;
    [key: string]: string | undefined;
}

export interface NotificationTemplate {
    title: string | ((params: TemplateParams) => string);
    body: (params: TemplateParams) => string;
    iconName: string;
    priority: NotificationPriority;
    route: (params: TemplateParams) => string;
}

export const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
    CREATE_ACCOUNT: {
        title: 'Welcome Aboard! 🎉',
        body: ({ userName }) =>
            `Hello ${userName || 'there'}! Your account has been configured successfully.`,
        iconName: 'UserCheck',
        priority: 'medium',
        route: () => '/dashboard/profile',
    },

    CREATE_LESSON: {
        title: 'New Lesson Published 📚',
        body: ({ lessonTitle, subjectName }) =>
            `A new lesson "${lessonTitle}" has been added to ${subjectName || 'your course'}.`,
        iconName: 'BookPlus',
        priority: 'medium',
        route: ({ lessonId }) => `/dashboard/lessons/${lessonId || ''}`,
    },

    UPDATE_LESSON: {
        title: 'Lesson Updated ✏️',
        body: ({ lessonTitle }) =>
            `The content or schedule for "${lessonTitle}" has been updated.`,
        iconName: 'FileEdit',
        priority: 'low',
        route: ({ lessonId }) => `/dashboard/lessons/${lessonId || ''}`,
    },

    DELETE_LESSON: {
        title: 'Lesson Removed 🗑️',
        body: ({ lessonTitle }) =>
            `The lesson "${lessonTitle}" was cancelled and removed from schedule.`,
        iconName: 'Trash2',
        priority: 'low',
        route: () => '/dashboard/lessons',
    },

    ASSIGN_TEACHER: {
        title: 'Faculty Assignment 👨‍🏫',
        body: ({ teacherName, className }) =>
            `${teacherName} has been assigned as lead instructor for ${className}.`,
        iconName: 'UserPlus',
        priority: 'medium',
        route: ({ classId }) => `/dashboard/classes/${classId || ''}`,
    },

    NEW_STUDENT_ENROLLED: {
        title: 'Student Enrollment 🎓',
        body: ({ studentName, className }) =>
            `${studentName} has enrolled in ${className}.`,
        iconName: 'GraduationCap',
        priority: 'low',
        route: ({ classId }) => `/dashboard/classes/${classId || ''}/students`,
    },

    PAYMENT_SUCCESS: {
        title: 'Payment Confirmed 💳',
        body: ({ amount }) =>
            `Received payment of $${amount || '0.00'} successfully.`,
        iconName: 'CreditCard',
        priority: 'high',
        route: ({ invoiceId }) => `/dashboard/billing/invoices/${invoiceId || ''}`,
    },

    ASSIGNMENT_SUBMITTED: {
        title: 'New Submission 📝',
        body: ({ studentName, assignmentTitle }) =>
            `${studentName} submitted assignment "${assignmentTitle}".`,
        iconName: 'FileCheck2',
        priority: 'low',
        route: ({ assignmentId }) => `/dashboard/assignments/${assignmentId || ''}/submissions`,
    },

    EXAM_SCHEDULED: {
        title: 'Upcoming Exam 📅',
        body: ({ examTitle, examDate }) =>
            `${examTitle} exam scheduled for ${examDate || 'soon'}.`,
        iconName: 'CalendarDays',
        priority: 'high',
        route: ({ examId }) => `/dashboard/exams/${examId || ''}`,
    },

    ATTENDANCE_ABSENT: {
        title: 'Absence Alert ⚠️',
        body: ({ studentName, className }) =>
            `Student ${studentName} was marked absent in ${className}.`,
        iconName: 'UserX',
        priority: 'urgent',
        route: ({ studentId }) => `/dashboard/attendance/logs?studentId=${studentId || ''}`,
    },

    FAMILY_MEMBER_LINKED: {
        title: 'Parent Account Linked 👪',
        body: ({ studentName }) =>
            `Parent account linked with student ${studentName}.`,
        iconName: 'Users',
        priority: 'low',
        route: ({ familyId }) => `/dashboard/family/${familyId || ''}`,
    },

    ANNOUNCEMENT_PUBLISHED: {
        title: 'Announcement 📢',
        body: ({ announcementTitle }) =>
            `${announcementTitle || 'New announcement published in the platform.'}`,
        iconName: 'Megaphone',
        priority: 'medium',
        route: ({ announcementId }) => `/dashboard/announcements/${announcementId || ''}`,
    },
};