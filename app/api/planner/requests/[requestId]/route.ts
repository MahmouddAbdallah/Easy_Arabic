import { NextRequest, NextResponse, after } from 'next/server';
import { errorResponse } from '@/lib/auth/request';
import { guard, notFoundIfBadId, parseBody, serviceErrorResponse } from '@/lib/planner/http';
import { notifyOfDecision, notifyTeacherOfWithdrawal } from '@/lib/planner/notifications';
import { decideRequest, withdrawRequest } from '@/lib/planner/service';
import { reviewRequestSchema } from '@/lib/planner/validation';

type Ctx = { params: Promise<{ requestId: string }> };

/**
 * PATCH: approve or reject. A teacher can only answer requests about their OWN lessons; an admin can answer any.
 * Approving applies the change to the lesson in the same transaction (and refuses if the new time would overlap).
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
    try {
        const { requestId } = await params;
        const { viewer, response } = await guard(req, ['teacher', 'admin'], { mutating: true });
        if (response) return response;
        const bad = notFoundIfBadId(requestId);
        if (bad) return bad;

        const body = await parseBody(req, reviewRequestSchema);
        if (body.response) return body.response;

        const result = await decideRequest(viewer, requestId, body.data);
        if (!result.ok) return serviceErrorResponse(result);

        const decidedBy = viewer.role === 'admin' ? 'admin' : 'teacher';
        after(() => notifyOfDecision(requestId, result.data, decidedBy));
        return NextResponse.json({
            success: true,
            message: result.data.status === 'APPROVED' ? 'Request approved. The lesson was updated.' : 'Request rejected. The lesson is unchanged.',
            status: result.data.status,
            newStartsAt: result.data.newStartsAt,
        });
    } catch (error) {
        console.error('PATCH /api/planner/requests/[requestId] failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}

/** DELETE: a family withdraws its own pending request (status becomes CANCELLED). The lesson was never touched. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
    try {
        const { requestId } = await params;
        const { viewer, response } = await guard(req, ['family'], { mutating: true });
        if (response) return response;
        const bad = notFoundIfBadId(requestId);
        if (bad) return bad;

        const result = await withdrawRequest(viewer, requestId);
        if (!result.ok) return serviceErrorResponse(result);

        after(() => notifyTeacherOfWithdrawal(result.data.teacherId, requestId, viewer.name));
        return NextResponse.json({ success: true, message: 'Request withdrawn.' });
    } catch (error) {
        console.error('DELETE /api/planner/requests/[requestId] failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}
