import 'server-only';
import { sendNotification } from '@/components/notification/lib/sendNotification';
import type { DecisionOutcome } from './service';

/**
 * All fire-and-forget: call them inside `after(() => ...)` so they stay off the response's critical path.
 * `sendNotification` never throws and nothing here may fail a request. Text is deliberately generic: lock screens
 * show it to bystanders, so it never contains times, reasons or student names.
 */

async function safely(label: string, send: () => Promise<unknown>) {
    try {
        await send();
    } catch (error) {
        console.error(`[planner] could not notify (${label}):`, error);
    }
}

export const notifyFamilyOfScheduledLessons = (familyId: string, count: number, teacherName: string) =>
    safely('scheduled', () =>
        sendNotification({
            userId: familyId,
            type: 'lesson',
            title: count === 1 ? 'New lesson scheduled' : `${count} new lessons scheduled`,
            body: `${teacherName} added to your planner. Open it to see the times.`,
            link: '/planner',
        })
    );

export const notifyFamilyOfLessonChange = (familyId: string, lessonId: string, action: 'cancel' | 'reschedule', teacherName: string) =>
    safely('lesson-change', () =>
        sendNotification({
            userId: familyId,
            type: 'lesson',
            title: action === 'cancel' ? 'A lesson was cancelled' : 'A lesson was moved',
            body: `${teacherName} updated your planner. Open it to see the change.`,
            link: '/planner',
            tag: `planner-lesson:${lessonId}`,
        })
    );

export const notifyTeacherOfRequest = (teacherId: string, requestId: string, familyName: string, type: 'CANCEL' | 'RESCHEDULE') =>
    safely('new-request', () =>
        sendNotification({
            userId: teacherId,
            type: 'lesson',
            title: type === 'CANCEL' ? 'Lesson cancellation request' : 'Lesson reschedule request',
            body: `${familyName} sent a request. Open your planner to answer it.`,
            link: '/planner',
            tag: `planner-request:${requestId}`,
        })
    );

export const notifyTeacherOfWithdrawal = (teacherId: string, requestId: string, familyName: string) =>
    safely('withdrawn', () =>
        sendNotification({
            userId: teacherId,
            type: 'lesson',
            title: 'Request withdrawn',
            body: `${familyName} withdrew their lesson request.`,
            link: '/planner',
            tag: `planner-request:${requestId}`,
        })
    );

/** The family always hears the answer; when an admin decided, the teacher is told too. */
export const notifyOfDecision = (requestId: string, outcome: DecisionOutcome, decidedBy: 'teacher' | 'admin') =>
    safely('decision', async () => {
        const approved = outcome.status === 'APPROVED';
        await sendNotification({
            userId: outcome.familyId,
            type: 'lesson',
            title: approved ? 'Lesson request approved' : 'Lesson request not approved',
            body: approved ? 'Your request was approved. Your planner is updated.' : 'Your request was reviewed. Open your planner to read the reply.',
            link: '/planner',
            tag: `planner-request:${requestId}`,
        });
        if (decidedBy === 'admin') {
            await sendNotification({
                userId: outcome.teacherId,
                type: 'lesson',
                title: approved ? 'An admin approved a lesson request' : 'An admin rejected a lesson request',
                body: 'Open your planner to see the change.',
                link: '/planner',
                tag: `planner-request:${requestId}`,
            });
        }
    });
