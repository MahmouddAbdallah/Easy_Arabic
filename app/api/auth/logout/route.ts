import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { errorResponse, forbiddenOrigin, isSameOrigin } from "@/lib/auth/request";

// POST (not GET): a state-changing GET can be triggered cross-site by an <img> tag.
export async function POST(req: NextRequest) {
    try {
        if (!isSameOrigin(req)) return forbiddenOrigin();
        await clearSessionCookie();
        return NextResponse.json({ message: 'Log out successfully!!' }, { status: 200 });
    } catch (error) {
        console.error('logout failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}
