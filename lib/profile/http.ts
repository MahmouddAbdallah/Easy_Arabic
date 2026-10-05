import 'server-only';
import type { NextRequest } from 'next/server';
import type { ZodType } from 'zod';
import { authorization } from '@/lib/verifyAuth';
import { authFailureResponse, errorResponse, forbiddenOrigin, invalidBody, isSameOrigin, readJsonBody } from '@/lib/auth/request';
import { firstValidationMessage } from '@/lib/validation';
import type { userType } from '@/types/userTypes';
import type { ServiceError } from './service';

type Guarded = { user: userType; response?: never } | { user?: never; response: Response };

/**
 * Every profile route starts here. The caller's identity comes from the signed session cookie
 * and nowhere else: no route in this feature reads a user id from the URL or the body.
 *   - mutating requests must come from our own origin (CSRF defence in depth),
 *   - the session must be valid and belong to `role`.
 */
export async function guard(req: NextRequest, role: 'family' | 'admin', { mutating }: { mutating: boolean }): Promise<Guarded> {
    if (mutating && !isSameOrigin(req)) return { response: forbiddenOrigin() };
    const { error, user } = await authorization([role]);
    if (error || !user) return { response: authFailureResponse(error?.code ?? 'NO_TOKEN') };
    return { user };
}

/** Reads a small JSON body and validates it. A bad body is a 400, with the first problem as the message. */
export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<{ data: T; response?: never } | { data?: never; response: Response }> {
    const body = await readJsonBody(req);
    if (body === null || typeof body !== 'object') return { response: invalidBody() };
    const result = schema.safeParse(body);
    if (!result.success) return { response: errorResponse('VALIDATION_ERROR', firstValidationMessage(result.error), 400) };
    return { data: result.data };
}

export const serviceErrorResponse = (e: ServiceError) => errorResponse(e.code, e.message, e.status);
