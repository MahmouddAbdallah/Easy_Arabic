import { NextResponse, NextRequest, after } from "next/server";
import { resendVerificationSchema, firstValidationMessage } from "@/lib/validation";
import { authConfig } from "@/lib/auth/config";
import { findUserByEmail } from "@/lib/auth/users";
import { issueToken } from "@/lib/auth/tokens";
import { consume, rateLimitKey } from "@/lib/auth/rateLimit";
import { sendVerificationEmail } from "@/lib/auth/email";
import { errorResponse, forbiddenOrigin, getClientIp, invalidBody, isSameOrigin, readJsonBody, tooManyRequests } from "@/lib/auth/request";

const GENERIC = { message: "If that account needs verification, we've sent a new link." };

export async function POST(req: NextRequest) {
    try {
        if (!isSameOrigin(req)) return forbiddenOrigin();

        const body = await readJsonBody(req);
        if (body === null) return invalidBody();
        const validation = resendVerificationSchema.safeParse(body);
        if (!validation.success) {
            return errorResponse('VALIDATION_ERROR', firstValidationMessage(validation.error), 400);
        }
        const { email } = validation.data;

        // 60s cooldown per address + hourly caps per address and per IP.
        // All keyed on the submitted email/IP, so responses don't depend on the account existing.
        const [cooldown, hourly, byIp] = await Promise.all([
            consume(rateLimitKey('resend:cooldown', email), { limit: 1, windowSeconds: 60 }),
            consume(rateLimitKey('resend:email', email), { limit: 5, windowSeconds: 60 * 60 }),
            consume(rateLimitKey('resend:ip', getClientIp(req)), { limit: 10, windowSeconds: 60 * 60 }),
        ]);
        const denied = [cooldown, hourly, byIp].filter((r) => !r.allowed);
        if (denied.length) return tooManyRequests(Math.max(...denied.map((r) => r.retryAfterSeconds)));

        after(async () => {
            try {
                const user = await findUserByEmail(email);
                if (!user || user.emailVerifiedAt || user.status === 'banned') return;
                const token = await issueToken(user.id, 'email_verification', authConfig.tokens.emailVerificationTtlSeconds);
                await sendVerificationEmail(user.email, token);
            } catch (error) {
                console.error('resend-verification background task failed:', error instanceof Error ? error.message : error);
            }
        });

        return NextResponse.json(GENERIC, { status: 200 });
    } catch (error) {
        console.error('resend-verification failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}
