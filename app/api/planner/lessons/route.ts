import { NextRequest, NextResponse, after } from 'next/server';
import { errorResponse } from '@/lib/auth/request';
import { guard, parseBody, parseQuery, serviceErrorResponse } from '@/lib/planner/http';
import { notifyFamilyOfScheduledLessons } from '@/lib/planner/notifications';
import { listLessons, resolveScope, scheduleLessons } from '@/lib/planner/service';
import { lessonsQuerySchema, scheduleLessonsSchema } from '@/lib/planner/validation';

/**
 * GET: the lessons of ONE planner inside a time window. A teacher or family always gets their own (the session
 * decides, never the query string); an admin names the teacher or family with ?teacherId= / ?familyId=.
 */
export async function GET(req: NextRequest) {
    try {
        const { viewer, response } = await guard(req, ['admin', 'teacher', 'family'], { mutating: false });
        if (response) return response;

        const query = parseQuery(req, lessonsQuerySchema);
        if (query.response) return query.response;
        const { from, to, teacherId, familyId } = query.data;

        const scope = await resolveScope(viewer, { teacherId, familyId });
        if (!scope.ok) return serviceErrorResponse(scope);

        const lessons = await listLessons(scope.data, new Date(from).toISOString(), new Date(to).toISOString());
        return NextResponse.json({ success: true, scope: scope.data, lessons });
    } catch (error) {
        console.error('GET /api/planner/lessons failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}

/** POST: a teacher schedules one or more future lessons for a family they are assigned to. */
export async function POST(req: NextRequest) {
    try {
        const { viewer, response } = await guard(req, ['teacher'], { mutating: true });
        if (response) return response;

        const body = await parseBody(req, scheduleLessonsSchema);
        if (body.response) return body.response;

        const result = await scheduleLessons(viewer, body.data);
        if (!result.ok) return serviceErrorResponse(result);

        const { lessons } = result.data;
        after(() => notifyFamilyOfScheduledLessons(body.data.familyId, lessons.length, viewer.name));
        return NextResponse.json(
            { success: true, message: lessons.length === 1 ? 'Lesson scheduled.' : `${lessons.length} lessons scheduled.`, lessons },
            { status: 201 }
        );
    } catch (error) {
        console.error('POST /api/planner/lessons failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}
