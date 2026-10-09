import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/auth/request';
import { guard } from '@/lib/planner/http';
import { listTeacherFamilies } from '@/lib/planner/service';

/** GET: the signed-in teacher's own assigned (active) families, for the "schedule a lesson" form. Takes no ids. */
export async function GET(req: NextRequest) {
    try {
        const { viewer, response } = await guard(req, ['teacher'], { mutating: false });
        if (response) return response;
        const families = await listTeacherFamilies(viewer.id);
        return NextResponse.json({ success: true, families });
    } catch (error) {
        console.error('GET /api/planner/families failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}
