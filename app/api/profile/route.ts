import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/auth/request';
import { guard, parseBody, serviceErrorResponse } from '@/lib/profile/http';
import { getProfileOverview, updateOwnProfile } from '@/lib/profile/service';
import { profileDirectUpdateSchema } from '@/lib/profile/validation';

/** The signed-in customer's own profile. The identity is the session; there is no id in the URL. */
export async function GET(req: NextRequest) {
    try {
        const { user, response } = await guard(req, 'family', { mutating: false });
        if (response) return response;

        const result = await getProfileOverview(user.id);
        if (!result.ok) return serviceErrorResponse(result);
        return NextResponse.json({ success: true, ...result.data });
    } catch (error) {
        console.error('GET /api/profile failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}

/**
 * Direct edit - name and subject only, and only while the profile is unlocked (no teacher
 * assigned AND the account is under 6 months old; enforced in the service). Email, phone and
 * every other key are rejected by the strict schema.
 */
export async function PATCH(req: NextRequest) {
    try {
        const { user, response } = await guard(req, 'family', { mutating: true });
        if (response) return response;

        const body = await parseBody(req, profileDirectUpdateSchema);
        if (body.response) return body.response;

        const result = await updateOwnProfile(user.id, body.data);
        if (!result.ok) return serviceErrorResponse(result);
        return NextResponse.json({ success: true, message: 'Profile updated.', profile: result.data });
    } catch (error) {
        console.error('PATCH /api/profile failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}
