import 'server-only';
import type { NextRequest } from 'next/server';
import type { ZodType } from 'zod';
import { authorization } from '@/lib/verifyAuth';
import { authFailureResponse, errorResponse, forbiddenOrigin, invalidBody, isSameOrigin, readJsonBody } from '@/lib/auth/request';
import { firstValidationMessage } from '@/lib/validation';
import type { PlannerRole } from '@/types/plannerTypes';
import { isValidId } from './validation';
import type { ServiceError, Viewer } from './service';

type Guarded = { viewer: Viewer; response?: never } | { viewer?: never; response: Response };

/**
 * Every planner route starts here (same idea as lib/profile/http.ts). The caller's identity comes from the signed
 * session cookie and nowhere else; the route's `roles` decide who may even try, and service.ts decides what they
 * may touch. Mutating requests must also come from our own origin (CSRF defence in depth).
 */
export async function guard(req: NextRequest, roles: PlannerRole[], { mutating }: { mutating: boolean }): Promise<Guarded> {
    if (mutating && !isSameOrigin(req)) return { response: forbiddenOrigin() };
    const { error, user } = await authorization(roles);
    if (error || !user) return { response: authFailureResponse(error?.code ?? 'NO_TOKEN') };
    return { viewer: { id: user.id, name: user.name, role: user.role } };
}

/** Reads a small JSON body and validates it (strict schemas: unknown fields are a 400). */
export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<{ data: T; response?: never } | { data?: never; response: Response }> {
    const body = await readJsonBody(req);
    if (body === null || typeof body !== 'object') return { response: invalidBody() };
    const result = schema.safeParse(body);
    if (!result.success) return { response: errorResponse('VALIDATION_ERROR', firstValidationMessage(result.error), 400) };
    return { data: result.data };
}

/** Validates the query string (`?a=1&b=2`). */
export function parseQuery<T>(req: NextRequest, schema: ZodType<T>): { data: T; response?: never } | { data?: never; response: Response } {
    const result = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!result.success) return { response: errorResponse('VALIDATION_ERROR', firstValidationMessage(result.error), 400) };
    return { data: result.data };
}

/** A malformed id in the URL is a plain 404, same as an id that doesn't exist. */
export const notFoundIfBadId = (id: string): Response | null => (isValidId(id) ? null : errorResponse('NOT_FOUND', 'Not found.', 404));

export const serviceErrorResponse = (e: ServiceError) =>
    errorResponse(e.code, e.message, e.status, e.conflicts ? { conflicts: e.conflicts } : undefined);
