import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

type ErrorExtras = Record<string, unknown>;

export function errorResponse(code: string, message: string, status: number, extras?: ErrorExtras, headers?: HeadersInit) {
    return NextResponse.json({ success: false, error: { code, message, ...extras } }, { status, headers });
}

export function tooManyRequests(retryAfterSeconds: number, message = 'Too many attempts. Please try again later.', code = 'TOO_MANY_ATTEMPTS') {
    const retryAfter = Math.max(1, Math.ceil(retryAfterSeconds));
    return errorResponse(code, message, 429, { retryAfterSeconds: retryAfter }, { 'Retry-After': String(retryAfter) });
}

/**
 * Best-effort client IP, used ONLY for throttling (never for authorization).
 * By default the right-most `X-Forwarded-For` entry is used: that is the one
 * appended by the reverse proxy closest to the app, which a client can't forge.
 * Override the header with TRUSTED_IP_HEADER (e.g. `cf-connecting-ip`,
 * `x-real-ip`) to match your platform. Without any header everyone shares the
 * "unknown" bucket, which errs on the side of stricter limits.
 */
export function getClientIp(req: NextRequest | Request): string {
    const headerName = (process.env.TRUSTED_IP_HEADER || 'x-forwarded-for').toLowerCase();
    const raw = req.headers.get(headerName);
    if (!raw) return 'unknown';
    const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
    const ip = headerName === 'x-forwarded-for' ? parts[parts.length - 1] : parts[0];
    return (ip || 'unknown').slice(0, 64);
}

/**
 * Keyed hash for identifiers stored in rate-limit keys, so the table never
 * holds a raw email or IP and can't be used to confirm that an address exists.
 */
export function hashIdentifier(value: string): string {
    const secret = process.env.JWT_SECRET || 'dev-only';
    return createHmac('sha256', secret).update(value).digest('hex').slice(0, 40);
}

/**
 * CSRF defence in depth for state-changing endpoints (cookies are already
 * SameSite=Lax): if the browser sent an Origin header it must be our own.
 */
export function isSameOrigin(req: NextRequest | Request): boolean {
    const origin = req.headers.get('origin');
    if (!origin) return true; // non-browser client or same-origin GET-less fetch
    try {
        const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
        return new URL(origin).host === host;
    } catch {
        return false;
    }
}

export const forbiddenOrigin = () => errorResponse('FORBIDDEN', 'Cross-origin request blocked.', 403);

const MAX_BODY_BYTES = 16 * 1024;

/** Reads a small JSON body; returns null when it is missing, malformed or too large. */
export async function readJsonBody(req: NextRequest | Request): Promise<unknown | null> {
    try {
        const text = await req.text();
        if (text.length > MAX_BODY_BYTES) return null;
        return JSON.parse(text);
    } catch {
        return null;
    }
}

export const invalidBody = () => errorResponse('VALIDATION_ERROR', 'Invalid request.', 400);

/** Maps an `authorization()` failure to the right HTTP response. */
export function authFailureResponse(code: string) {
    switch (code) {
        case 'NO_TOKEN':
        case 'TOKEN_EXPIRED':
        case 'INVALID_TOKEN':
        case 'USER_NOT_FOUND':
            return errorResponse('UNAUTHENTICATED', 'Please sign in.', 401);
        case 'SERVER_ERROR':
            return errorResponse('SERVER_ERROR', 'Error in server', 500);
        default:
            return errorResponse('FORBIDDEN', 'Forbidden', 403);
    }
}
