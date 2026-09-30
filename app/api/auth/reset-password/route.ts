import { NextResponse, NextRequest, after } from "next/server";
import { passwordResetSchema, firstValidationMessage } from "@/lib/validation";
import { hashPassword } from "@/lib/auth/password";
import { consumeToken } from "@/lib/auth/tokens";
import { clearAccountLoginFailures, consume, rateLimitKey } from "@/lib/auth/rateLimit";
import { sendPasswordChangedEmail } from "@/lib/auth/email";
import { errorResponse, forbiddenOrigin, getClientIp, invalidBody, isSameOrigin, readJsonBody, tooManyRequests } from "@/lib/auth/request";
import { db } from "@/prisma/db";

const INVALID_LINK = 'This reset link is invalid or has expired. Please request a new one.';

export async function POST(req: NextRequest) {
    try {
        if (!isSameOrigin(req)) return forbiddenOrigin();

        const body = await readJsonBody(req);
        if (body === null) return invalidBody();
        const validation = passwordResetSchema.safeParse(body);
        if (!validation.success) {
            return errorResponse('VALIDATION_ERROR', firstValidationMessage(validation.error), 400);
        }
        const { token, newPassword } = validation.data;

        const limit = await consume(rateLimitKey('reset:ip', getClientIp(req)), { limit: 10, windowSeconds: 15 * 60 });
        if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

        const passwordHash = await hashPassword(newPassword);

        // One transaction: the token is burned ONLY if the password really
        // changed, and a concurrent second use of the same link finds nothing.
        const changed = await db.transaction(async (tx) => {
            const userId = await consumeToken(token, 'password_reset', tx);
            if (!userId) return null;

            const user = await tx.orm.public.User.where({ id: userId }).first();
            if (!user) return null;

            const now = new Date().toISOString();
            await tx.orm.public.User.where({ id: userId }).update({
                password: passwordHash,
                // Moving this instant is what signs out every existing session.
                passwordLastChanged: now,
                updatedAt: now,
                // Receiving the email proves the owner controls the address.
                ...(user.emailVerifiedAt ? {} : { emailVerifiedAt: now }),
            });
            // Any other outstanding reset link for this user dies too.
            await tx.orm.public.AuthToken.where({ userId, type: 'password_reset' }).delete();
            return { email: user.email };
        });

        if (!changed) return errorResponse('INVALID_TOKEN', INVALID_LINK, 400);

        // The owner just proved control of the email: lift any failed-login lockout tied to it.
        await clearAccountLoginFailures(changed.email);
        after(() => sendPasswordChangedEmail(changed.email));

        // No session is created: the user signs in with the new password.
        return NextResponse.json({ message: 'Your password has been reset. Please sign in.' }, { status: 200 });
    } catch (error) {
        console.error('reset-password failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}
