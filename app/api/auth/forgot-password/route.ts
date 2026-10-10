import { NextResponse, NextRequest, after } from "next/server";
import { forgotPasswordSchema, firstValidationMessage } from "@/lib/validation";
import { authConfig } from "@/lib/auth/config";
import { findUserByEmail } from "@/lib/auth/users";
import { issueToken } from "@/lib/auth/tokens";
import { consume, rateLimitKey } from "@/lib/auth/rateLimit";
import { sendPasswordResetEmail } from "@/lib/auth/email";
import { errorResponse, forbiddenOrigin, getClientIp, invalidBody, isSameOrigin, readJsonBody, tooManyRequests } from "@/lib/auth/request";
import { notifyAdminsOfForgotPassword } from "@/lib/auth/notifications";

const GENERIC = { message: "If an account exists for that email, we've sent instructions to reset the password." };

export async function POST(req: NextRequest) {
    try {
        if (!isSameOrigin(req)) return forbiddenOrigin();

        const body = await readJsonBody(req);
        if (body === null) return invalidBody();
        const validation = forgotPasswordSchema.safeParse(body);
        if (!validation.success) {
            return errorResponse('VALIDATION_ERROR', firstValidationMessage(validation.error), 400);
        }
        const { email } = validation.data;

        // Limits are keyed on what was SUBMITTED, so they trip identically for
        // real and non-existent accounts.
        const [byIp, byEmail] = await Promise.all([
            consume(rateLimitKey('forgot:ip', getClientIp(req)), { limit: 10, windowSeconds: 15 * 60 }),
            consume(rateLimitKey('forgot:email', email), { limit: 3, windowSeconds: 60 * 60 }),
        ]);
        if (!byIp.allowed || !byEmail.allowed) {
            return tooManyRequests(Math.max(byIp.allowed ? 0 : byIp.retryAfterSeconds, byEmail.allowed ? 0 : byEmail.retryAfterSeconds));
        }

        // Everything that depends on whether the user exists happens AFTER the
        // response is sent, so neither the body nor the timing gives it away.
        after(async () => {
            try {
                const user = await findUserByEmail(email);
                if (!user) return;
                const ttl = authConfig.tokens.passwordResetTtlSeconds;
                const token = await issueToken(user.id, 'password_reset', ttl);
                await sendPasswordResetEmail(user.email, token, Math.round(ttl / 60));
                notifyAdminsOfForgotPassword(user.id, user.name)
            } catch (error) {
                console.error('forgot-password background task failed:', error instanceof Error ? error.message : error);
            }
        });

        return NextResponse.json(GENERIC, { status: 200 });
    } catch (error) {
        console.error('forgot-password failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}
