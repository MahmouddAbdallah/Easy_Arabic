import { NextRequest, NextResponse, after } from 'next/server';
import { errorResponse } from '@/lib/auth/request';
import { guard, parseBody, parseQuery, serviceErrorResponse } from '@/lib/planner/http';
import { notifyTeacherOfRequest } from '@/lib/planner/notifications';
import { listRequests, resolveScope, submitRequest } from '@/lib/planner/service';
import { requestsQuerySchema, submitRequestSchema } from '@/lib/planner/validation';

/** GET: the change requests of ONE planner (a teacher's lessons / a family's own / the admin's chosen subject). */
export async function GET(req: NextRequest) {
    try {
        const { viewer, response } = await guard(req, ['admin', 'teacher', 'family'], { mutating: false });
        if (response) return response;

        const query = parseQuery(req, requestsQuerySchema);
        if (query.response) return query.response;
        const { status, page, pageSize, teacherId, familyId } = query.data;

        const scope = await resolveScope(viewer, { teacherId, familyId });
        if (!scope.ok) return serviceErrorResponse(scope);

        const list = await listRequests(viewer, scope.data, { status, page, pageSize });
        return NextResponse.json({ success: true, ...list });
    } catch (error) {
        console.error('GET /api/planner/requests failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}

/** POST: a family asks its teacher to cancel or reschedule one of ITS OWN upcoming lessons. Nothing changes until approval. */
export async function POST(req: NextRequest) {
    try {
        const { viewer, response } = await guard(req, ['family'], { mutating: true });
        if (response) return response;

        const body = await parseBody(req, submitRequestSchema);
        if (body.response) return body.response;

        const result = await submitRequest(viewer, body.data);
        if (!result.ok) return serviceErrorResponse(result);

        const { request, teacherId } = result.data;
        after(() => notifyTeacherOfRequest(teacherId, request.id, viewer.name, request.type));
        return NextResponse.json(
            { success: true, message: 'Request sent. Your teacher will review it soon.', request },
            { status: 201 }
        );
    } catch (error) {
        console.error('POST /api/planner/requests failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}
