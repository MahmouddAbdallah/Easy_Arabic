
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firebaseAdminDB } from "../config/firebase-admin";
import { FirestoreNotificationDoc, ICON_MAP, NOTIFICATION_TEMPLATES, NotificationMetadata, NotificationPayload, NotificationType, TemplateParams } from "./data";
import { UserCheck } from "lucide-react";

export function buildNotificationFromTemplate(
    type: NotificationType,
    params: TemplateParams,
    metadata?: NotificationMetadata
): Omit<FirestoreNotificationDoc, 'createdAt' | 'isRead'> {
    const template = NOTIFICATION_TEMPLATES[type];

    const title = typeof template.title === 'function' ? template.title(params) : template.title;
    const body = template.body(params);
    const route = template.route(params);

    return {
        type,
        title,
        body,
        iconName: template.iconName,
        priority: template.priority,
        route,
        metadata,
    };
}

export async function sendNotificationFromTemplate(
    userId: string,
    type: NotificationType,
    params: TemplateParams,
    metadata?: NotificationMetadata
) {
    try {
        const notifData = buildNotificationFromTemplate(type, params, metadata);
        const userNotifsRef = firebaseAdminDB.collection('users').doc(userId).collection('notifications');

        const docRef = await userNotifsRef.add({
            ...notifData,
            isRead: false,
            createdAt: FieldValue.serverTimestamp(),
        });

        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error sending notification via Admin SDK:', error);
        throw error;
    }
}

export async function seedTemplateNotificationsForUser(userId: string, userName: string) {
    try {
        const batch = firebaseAdminDB.batch();
        const userNotifsRef = firebaseAdminDB.collection('users').doc(userId).collection('notifications');

        const sampleItems = [
            buildNotificationFromTemplate('CREATE_ACCOUNT', { userName }),
            buildNotificationFromTemplate(
                'CREATE_LESSON',
                { lessonTitle: 'Chemical Bonding', subjectName: 'Chemistry', lessonId: 'les_101' },
                { lessonId: 'les_101' }
            ),
            buildNotificationFromTemplate(
                'EXAM_SCHEDULED',
                { examTitle: 'Physics Midterm', examDate: 'Thursday at 10:00 AM', examId: 'exm_01' },
                { examId: 'exm_01' }
            ),
            buildNotificationFromTemplate(
                'PAYMENT_SUCCESS',
                { amount: '150.00', invoiceId: 'inv_88' },
                { invoiceId: 'inv_88' }
            ),
        ];

        sampleItems.forEach((item) => {
            const newDocRef = userNotifsRef.doc();
            batch.set(newDocRef, {
                ...item,
                isRead: false,
                createdAt: FieldValue.serverTimestamp(),
            });
        });

        await batch.commit();
        return { success: true, count: sampleItems.length };
    } catch (error) {
        console.error('Error seeding notifications via Admin SDK:', error);
        throw error;
    }
}

export async function getUserNotifications(userId: string): Promise<NotificationPayload[]> {
    try {
        const userNotifsRef = firebaseAdminDB.collection('users').doc(userId).collection('notifications');
        const snapshot = await userNotifsRef.orderBy('createdAt', 'desc').get();

        return snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            const IconComponent = ICON_MAP[data.iconName] || UserCheck;

            const createdAtTimestamp = data.createdAt as Timestamp | undefined;
            const createdAtISO = createdAtTimestamp?.toDate
                ? createdAtTimestamp.toDate().toISOString()
                : new Date().toISOString();

            return {
                id: docSnap.id,
                type: data.type,
                title: data.title,
                body: data.body,
                icon: IconComponent,
                route: data.route,
                priority: data.priority,
                isRead: data.isRead,
                createdAt: createdAtISO,
                metadata: data.metadata,
            };
        });
    } catch (error) {
        console.error('Error fetching notifications via Admin SDK:', error);
        return [];
    }
}

export async function markNotificationAsRead(userId: string, notificationId: string) {
    try {
        const notifRef = firebaseAdminDB
            .collection('users')
            .doc(userId)
            .collection('notifications')
            .doc(notificationId);

        await notifRef.update({ isRead: true });
        return { success: true };
    } catch (error) {
        console.error('Error marking notification as read via Admin SDK:', error);
        throw error;
    }
}