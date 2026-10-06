/**
 * SERVER ONLY. Auth, validation and error-response helpers shared by the Blog route handlers
 * (app/api/blog/*). Route files can't export helpers, so they live here, the same way the chat's do.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorization } from "@/lib/verifyAuth";
import { forbiddenOrigin, isSameOrigin } from "@/lib/auth/request";
import type { userType } from "@/types/userTypes";
import { BlogContentError } from "./content";

/** A failure the caller should see as-is (code, message, status), as opposed to an unexpected crash. */
export class BlogApiError extends Error {
    readonly code: string;
    readonly status: number;
    readonly details?: unknown;

    constructor(code: string, message: string, status: number, details?: unknown) {
        super(message);
        this.name = "BlogApiError";
        this.code = code;
        this.status = status;
        this.details = details;
    }
}

export function errorResponse(code: string, message: string, status: number, details?: unknown, headers?: HeadersInit) {
    return NextResponse.json(
        { success: false, error: { code, message, ...(details ? { details } : {}) } },
        { status, headers }
    );
}

const UNAUTHENTICATED_CODES = ["NO_TOKEN", "TOKEN_EXPIRED", "INVALID_TOKEN", "USER_NOT_FOUND"];

/**
 * The signed-in admin, or the response to return instead (401 / 403 / 500). Every Blog route that
 * reads or changes data through the API goes through this; there is no public API surface. For
 * requests that change something it also refuses cross-origin browser requests.
 */
export async function requireAdmin(
    req: Request
): Promise<{ user: userType; response?: undefined } | { user?: undefined; response: NextResponse }> {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !isSameOrigin(req)) {
        return { response: forbiddenOrigin() };
    }

    const { error, user } = await authorization(["admin"]);
    if (error || !user) {
        const code = error?.code ?? "NO_TOKEN";
        const status = UNAUTHENTICATED_CODES.includes(code) ? 401 : code === "SERVER_ERROR" ? 500 : 403;
        return { response: errorResponse(code, error?.message ?? "You're not logged in.", status) };
    }
    return { user };
}

/** The JSON body validated against `schema`, or the 400 response to return instead. */
export async function parseBody<S extends z.ZodType>(
    req: Request,
    schema: S
): Promise<{ data: z.output<S>; response?: undefined } | { data?: undefined; response: NextResponse }> {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return { response: errorResponse("INVALID_JSON", "Request body must be valid JSON.", 400) };
    }

    const validation = schema.safeParse(body);
    if (!validation.success) {
        const fieldErrors = z.flattenError(validation.error).fieldErrors as Record<string, string[] | undefined>;
        const first = Object.values(fieldErrors).flat().find(Boolean);
        return { response: errorResponse("VALIDATION_ERROR", first ?? "Some fields are invalid.", 400, fieldErrors) };
    }
    return { data: validation.data };
}

/** Known Blog errors keep their code/status; anything else is logged and becomes a generic 500. */
export function handleRouteError(error: unknown, logLabel: string, fallbackMessage: string) {
    if (error instanceof BlogApiError) return errorResponse(error.code, error.message, error.status, error.details);
    if (error instanceof BlogContentError) {
        return errorResponse("INVALID_CONTENT", error.message, 400, { content: [error.message], path: error.path });
    }
    console.error(`${logLabel}:`, error);
    return errorResponse("SERVER_ERROR", fallbackMessage, 500);
}
