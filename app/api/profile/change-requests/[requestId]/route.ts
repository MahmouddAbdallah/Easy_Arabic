import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/auth/request';
import { guard, serviceErrorResponse } from '@/lib/profile/http';
import { cancelChangeRequest } from '@/lib/profile/service';

/** Customer withdraws their own pending request. Scoped to the session user inside the query. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
    try {
        const { user, response } = await guard(req, 'family', { mutating: true });
        if (response) return response;

        const { requestId } = await params;
        const result = await cancelChangeRequest(user.id, requestId);
        if (!result.ok) return serviceErrorResponse(result);
        return NextResponse.json({ success: true, message: 'Request withdrawn.' });
    } catch (error) {
        console.error('DELETE /api/profile/change-requests/[requestId] failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}
