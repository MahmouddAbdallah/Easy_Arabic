import jwt, { JwtPayload } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { authConfig, isProduction } from '@/lib/auth/config';

function getSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not set.');
    if (secret.length < 32) console.warn('[auth] JWT_SECRET is shorter than 32 characters; use `openssl rand -base64 48`.');
    return secret;
}

/** Parses the DB timestamp string into epoch milliseconds (throws on garbage). */
export function toEpochMs(value: string | Date): number {
    const ms = new Date(value).getTime();
    if (Number.isNaN(ms)) throw new Error('Invalid timestamp');
    return ms;
}

export type SessionClaims = { id: string; pv: number };

/**
 * `pv` ("password version") is the exact passwordLastChanged instant the token
 * was minted against. Changing or resetting the password moves that instant,
 * which instantly invalidates every token issued before it (on every device).
 */
export function signSessionToken(user: { id: string; passwordLastChanged: string | Date }): string {
    return jwt.sign(
        { id: user.id, pv: toEpochMs(user.passwordLastChanged) } satisfies SessionClaims,
        getSecret(),
        { algorithm: 'HS256', expiresIn: authConfig.session.maxAgeSeconds }
    );
}

/** Throws jsonwebtoken's TokenExpiredError / JsonWebTokenError on failure. */
export function verifySessionToken(token: string): JwtPayload & Partial<SessionClaims> {
    return jwt.verify(token, getSecret(), { algorithms: ['HS256'] }) as JwtPayload & Partial<SessionClaims>;
}

const cookieBase = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
};

export async function setSessionCookie(user: { id: string; passwordLastChanged: string | Date }) {
    const cookieStore = await cookies();
    cookieStore.set({
        ...cookieBase,
        name: authConfig.session.cookieName,
        value: signSessionToken(user),
        maxAge: authConfig.session.maxAgeSeconds,
    });
}

export async function clearSessionCookie() {
    const cookieStore = await cookies();
    // Same attributes as when it was set, otherwise some browsers keep it.
    cookieStore.set({ ...cookieBase, name: authConfig.session.cookieName, value: '', maxAge: 0, expires: new Date(0) });
}
