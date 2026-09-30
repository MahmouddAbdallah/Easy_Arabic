import { NextResponse, NextRequest } from "next/server";
import { verifyEmailSchema, firstValidationMessage } from "@/lib/validation";
import { consumeToken } from "@/lib/auth/tokens";
import { consume, rateLimitKey } from "@/lib/auth/rateLimit";
import { errorResponse, forbiddenOrigin, getClientIp, invalidBody, isSameOrigin, readJsonBody, tooManyRequests } from "@/lib/auth/request";
import { db } from "@/prisma/db";

export async function POST(req: NextRequest) {
    try {
        if (!isSameOrigin(req)) return forbiddenOrigin();

        const body = await readJsonBody(req);
        if (body === null) return invalidBody();
        const validation = verifyEmailSchema.safeParse(body);
        if (!validation.success) {
            return errorResponse('VALIDATION_ERROR', firstValidationMessage(validation.error), 400);
        }

        const limit = await consume(rateLimitKey('verify:ip', getClientIp(req)), { limit: 20, windowSeconds: 15 * 60 });
        if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

        const userId = await consumeToken(validation.data.token, 'email_verification');
        if (!userId) {
            return errorResponse('INVALID_TOKEN', 'This verification link is invalid or has expired.', 400);
        }

        const now = new Date().toISOString();
        const user = await db.orm.public.User.where({ id: userId }).first();
        if (user && !user.emailVerifiedAt) {
            await db.orm.public.User.where({ id: userId }).update({ emailVerifiedAt: now, updatedAt: now });
        }

        return NextResponse.json({ message: 'Your email has been verified. You can sign in now.' }, { status: 200 });
    } catch (error) {
        console.error('verify-email failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}
