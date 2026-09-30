import { NextResponse, NextRequest } from "next/server";
import { signInSchema, firstValidationMessage } from "@/lib/validation";
import { authConfig } from "@/lib/auth/config";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/auth/users";
import { beginLoginAttempt, completeLoginSuccess } from "@/lib/auth/rateLimit";
import { errorResponse, forbiddenOrigin, getClientIp, invalidBody, isSameOrigin, readJsonBody, tooManyRequests } from "@/lib/auth/request";

const LOCKED_MESSAGE = 'Too many failed sign-in attempts. Please wait before trying again.';

export async function POST(req: NextRequest) {
    try {
        if (!isSameOrigin(req)) return forbiddenOrigin();

        const body = await readJsonBody(req);
        if (body === null) return invalidBody();
        const validation = signInSchema.safeParse(body);
        if (!validation.success) {
            return errorResponse('VALIDATION_ERROR', firstValidationMessage(validation.error), 400);
        }
        const { email, password } = validation.data;
        const ip = getClientIp(req);

        // 1. Reserve an attempt slot atomically BEFORE looking at the password.
        //    A burst of parallel guesses gets distinct ordinals, so at most
        //    `maxAttempts` of them are ever evaluated; a locked client learns
        //    nothing and can't keep guessing. Keyed by the submitted email
        //    whether or not an account exists.
        const attempt = await beginLoginAttempt(email, ip);
        if (!attempt.allowed) return tooManyRequests(attempt.retryAfterSeconds, LOCKED_MESSAGE, 'LOGIN_LOCKED');

        // 2. One generic outcome for "no such user" and "wrong password", with
        //    equal work (a dummy bcrypt compare runs when the user is unknown).
        const user = await findUserByEmail(email);
        const passwordOk = await verifyPassword(password, user?.password);
        if (!user || !passwordOk) {
            // retryAfterSeconds > 0 here means THIS failed attempt was the one that armed the lockout.
            if (attempt.retryAfterSeconds > 0) return tooManyRequests(attempt.retryAfterSeconds, LOCKED_MESSAGE, 'LOGIN_LOCKED');
            return errorResponse('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
        }

        // 3. Only someone who knows the password sees account-status details.
        //    Banned/suspended users never get a session.
        if (user.status === 'banned') {
            return errorResponse('ACCOUNT_BANNED', 'This account has been banned.', 403);
        }
        if (user.status === 'suspended') {
            return errorResponse('ACCOUNT_SUSPENDED', 'This account is temporarily suspended.', 403);
        }
        if (authConfig.requireEmailVerification && !user.emailVerifiedAt) {
            return errorResponse('EMAIL_NOT_VERIFIED', 'Please verify your email address before signing in.', 403);
        }

        await completeLoginSuccess(email, ip);
        await setSessionCookie(user);

        return NextResponse.json({ message: 'Signed in successfully' }, { status: 200 });
    } catch (error) {
        console.error('sign-in failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}
