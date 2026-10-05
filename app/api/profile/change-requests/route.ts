import { NextRequest, NextResponse, after } from 'next/server';
import { errorResponse } from '@/lib/auth/request';
import { guard, parseBody, serviceErrorResponse } from '@/lib/profile/http';
import { notifyAdminsOfNewRequest } from '@/lib/profile/notifications';
import { submitChangeRequest } from '@/lib/profile/service';
import { profileChangeSubmitSchema } from '@/lib/profile/validation';

/** Customer asks the admin to change their details. One pending request at a time. */
export async function POST(req: NextRequest) {
    try {
        const { user, response } = await guard(req, 'family', { mutating: true });
        if (response) return response;

        const body = await parseBody(req, profileChangeSubmitSchema);
        if (body.response) return body.response;

        const result = await submitChangeRequest(user.id, body.data);
        if (!result.ok) return serviceErrorResponse(result);

        after(() => notifyAdminsOfNewRequest(result.data.id, user.name));
        return NextResponse.json(
            { success: true, message: 'Request sent. The admin will review it soon.', request: result.data },
            { status: 201 }
        );
    } catch (error) {
        console.error('POST /api/profile/change-requests failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}
