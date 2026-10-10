import { NextResponse, NextRequest, after } from "next/server";
import { signUpSchema, firstValidationMessage } from "@/lib/validation";
import { hashPassword } from "@/lib/auth/password";
import { findUserByEmail } from "@/lib/auth/users";
import { consume, rateLimitKey } from "@/lib/auth/rateLimit";
import { sendAccountExistsEmail } from "@/lib/auth/email";
import { notifyAdminsOfNewCustomer } from "@/lib/auth/notifications";
import { errorResponse, forbiddenOrigin, getClientIp, invalidBody, isSameOrigin, readJsonBody, tooManyRequests } from "@/lib/auth/request";
import { db } from "@/prisma/db";
import { setSessionCookie } from "@/lib/auth/session";

// The SAME response is returned whether or not the email is already
// registered, so this form can't be used to discover who has an account.
const GENERIC = {
    message: 'Thanks! If this email can be registered, your account is ready. Check your inbox to verify your email, then sign in.',
};

export async function POST(req: NextRequest) {
    try {
        if (!isSameOrigin(req)) return forbiddenOrigin();

        const body = await readJsonBody(req);
        if (body === null) return invalidBody();
        const validation = signUpSchema.safeParse(body);
        if (!validation.success) {
            return errorResponse('VALIDATION_ERROR', firstValidationMessage(validation.error), 400);
        }
        const data = validation.data;

        // Abuse limits: per IP (mass registration) and per address (so the form
        // can't be used to mail-bomb someone). Both are keyed on the submitted
        // values, so they behave the same for new and existing emails.
        const [byIp, byEmail] = await Promise.all([
            consume(rateLimitKey('signup:ip', getClientIp(req)), { limit: 5, windowSeconds: 60 * 60 }),
            consume(rateLimitKey('signup:email', data.email), { limit: 3, windowSeconds: 60 * 60 }),
        ]);
        if (!byIp.allowed || !byEmail.allowed) {
            return tooManyRequests(Math.max(byIp.allowed ? 0 : byIp.retryAfterSeconds, byEmail.allowed ? 0 : byEmail.retryAfterSeconds));
        }

        // Hash first, always: the request takes the same time either way.
        const passwordHash = await hashPassword(data.password);

        const existing = await findUserByEmail(data.email);
        if (existing) {
            after(() => sendAccountExistsEmail(existing.email));
            return NextResponse.json(GENERIC, { status: 201 });
        }

        try {
            const user = await db.orm.public.User.create({
                name: data.name,
                email: data.email,
                phone: data.phone,
                password: passwordHash,
            });
            // Reached only once the account exists: a lost race throws above, and an existing
            // email returned earlier, so exactly one admin notification per new customer.
            after(() => notifyAdminsOfNewCustomer(user.id, user.name));
            // after(async () => {
            //     const token = await issueToken(user.id, 'email_verification', authConfig.tokens.emailVerificationTtlSeconds);
            //     await sendVerificationEmail(user.email, token);
            // });
            await setSessionCookie(user);
        } catch (error) {
            // Two simultaneous sign-ups for one email: the unique index lets
            // exactly one win. The loser gets the same generic response.
            if (await findUserByEmail(data.email)) return NextResponse.json(GENERIC, { status: 201 });
            throw error;
        }

        // Deliberately no session here: signing the caller in only on "new
        // email" would reveal which emails already exist.
        return NextResponse.json(GENERIC, { status: 201 });
    } catch (error) {
        console.error('sign-up failed:', error instanceof Error ? error.message : error);
        return errorResponse('SERVER_ERROR', 'Error in server', 500);
    }
}
