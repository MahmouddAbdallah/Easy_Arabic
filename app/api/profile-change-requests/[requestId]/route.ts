import { NextRequest, NextResponse, after } from 'next/server';
import { errorResponse } from '@/lib/auth/request';
import { guard, parseBody, serviceErrorResponse } from '@/lib/profile/http';
import { notifyCustomerOfDecision } from '@/lib/profile/notifications';
import { reviewChangeRequest } from '@/lib/profile/service';
import { profileChangeReviewSchema } from '@/lib/profile/validation';

/** Admin approves (applies the changes) or rejects (with a note) a pending request. Admin only. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
    try {
        const { user: admin, response } = await guard(req, 'admin', { mutating: true });
        if (response) return response;

        const body = await parseBody(req, profileChangeReviewSchema);
        if (body.response) return body.response;

        const { requestId } = await params;
        const result = await reviewChangeRequest(admin.id, requestId, body.data);
        if (!result.ok) return serviceErrorResponse(result);

        const approved = result.data.status === 'APPROVED';
        after(() => notifyCustomerOfDecision(result.data.familyId, requestId, approved));
        return NextResponse.json({
            success: true,
            message: approved ? 'Request approved and the profile was updated.' : 'Request rejected.',
            status: result.data.status,
            applied: result.data.applied,
        });
    } catch (error) {
        console.error('PATCH /api/profile-change-requests/[requestId] failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}
