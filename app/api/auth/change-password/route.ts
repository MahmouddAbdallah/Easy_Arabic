import { NextResponse, NextRequest, after } from "next/server";
import { passwordChangeSchema, firstValidationMessage } from "@/lib/validation";
import { authorization } from "@/lib/verifyAuth";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { registerAttempt, resetKey, rateLimitKey } from "@/lib/auth/rateLimit";
import { authConfig } from "@/lib/auth/config";
import { sendPasswordChangedEmail } from "@/lib/auth/email";
import { authFailureResponse, errorResponse, forbiddenOrigin, invalidBody, isSameOrigin, readJsonBody, tooManyRequests } from "@/lib/auth/request";
import { db } from "@/prisma/db";

export async function POST(req: NextRequest) {
    try {
        if (!isSameOrigin(req)) return forbiddenOrigin();

        const { error, user: sessionUser } = await authorization();
        if (error || !sessionUser) return authFailureResponse(error?.code ?? 'NO_TOKEN');

        const body = await readJsonBody(req);
        if (body === null) return invalidBody();
        const validation = passwordChangeSchema.safeParse(body);
        if (!validation.success) {
            return errorResponse('VALIDATION_ERROR', firstValidationMessage(validation.error), 400);
        }
        const { currentPassword, newPassword } = validation.data;

        // Someone holding a stolen session must not be able to brute-force the
        // current password here: same lockout rules as sign-in, per user, with
        // the attempt reserved atomically before the password is checked.
        const key = rateLimitKey('pwchange:user', sessionUser.id);
        const attempt = await registerAttempt(key, {
            maxAttempts: authConfig.login.maxAttempts,
            blockSeconds: authConfig.login.lockoutSeconds,
            windowSeconds: authConfig.login.windowSeconds,
        });
        const LOCKED = 'Too many incorrect attempts. Please wait before trying again.';
        if (attempt.count > authConfig.login.maxAttempts) {
            return tooManyRequests(attempt.retryAfterSeconds, LOCKED, 'PASSWORD_CHANGE_LOCKED');
        }

        const user = await db.orm.public.User.where({ id: sessionUser.id }).first();
        if (!user) return authFailureResponse('USER_NOT_FOUND');

        if (!(await verifyPassword(currentPassword, user.password))) {
            if (attempt.retryAfterSeconds > 0) return tooManyRequests(attempt.retryAfterSeconds, LOCKED, 'PASSWORD_CHANGE_LOCKED');
            return errorResponse('INVALID_CREDENTIALS', 'Your current password is incorrect.', 400);
        }

        if (await verifyPassword(newPassword, user.password)) {
            return errorResponse('VALIDATION_ERROR', 'Your new password must be different from the current one.', 400);
        }

        const now = new Date().toISOString();
        const passwordHash = await hashPassword(newPassword);
        const updated = await db.transaction(async (tx) => {
            const row = await tx.orm.public.User.where({ id: user.id }).update({
                password: passwordHash,
                passwordLastChanged: now, // invalidates every session issued before now
                updatedAt: now,
            });
            await tx.orm.public.AuthToken.where({ userId: user.id, type: 'password_reset' }).delete();
            return row;
        });

        await resetKey(key);
        // Old sessions are dead; give THIS device a fresh one so the user isn't bounced to sign-in.
        await setSessionCookie({ id: user.id, passwordLastChanged: (updated as { passwordLastChanged?: string } | null)?.passwordLastChanged ?? now });
        after(() => sendPasswordChangedEmail(user.email));

        return NextResponse.json({ message: 'Password changed. You were signed out on your other devices.' }, { status: 200 });
    } catch (error) {
        console.error('change-password failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}
