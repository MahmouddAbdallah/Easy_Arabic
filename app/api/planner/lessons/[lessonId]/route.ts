import { NextRequest, NextResponse, after } from 'next/server';
import { errorResponse } from '@/lib/auth/request';
import { guard, notFoundIfBadId, parseBody, serviceErrorResponse } from '@/lib/planner/http';
import { notifyFamilyOfLessonChange } from '@/lib/planner/notifications';
import { changeOwnLesson } from '@/lib/planner/service';
import { changeLessonSchema } from '@/lib/planner/validation';

type Ctx = { params: Promise<{ lessonId: string }> };

/** PATCH: a teacher cancels or moves one of THEIR OWN upcoming scheduled lessons (conflict-checked). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
    try {
        const { lessonId } = await params;
        const { viewer, response } = await guard(req, ['teacher'], { mutating: true });
        if (response) return response;
        const bad = notFoundIfBadId(lessonId);
        if (bad) return bad;

        const body = await parseBody(req, changeLessonSchema);
        if (body.response) return body.response;

        const result = await changeOwnLesson(viewer, lessonId, body.data);
        if (!result.ok) return serviceErrorResponse(result);

        after(() => notifyFamilyOfLessonChange(result.data.familyId, lessonId, result.data.action, viewer.name));
        return NextResponse.json({
            success: true,
            message: result.data.action === 'cancel' ? 'Lesson cancelled.' : 'Lesson moved.',
            lesson: result.data,
        });
    } catch (error) {
        console.error('PATCH /api/planner/lessons/[lessonId] failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}
