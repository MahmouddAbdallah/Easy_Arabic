/**
 * SERVER ONLY. Response, auth and body-parsing helpers shared by the chat route handlers
 * (app/api/chat/*). Route files can't export helpers, so they live here.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorization } from "@/lib/verifyAuth";
import type { userType } from "@/types/userTypes";
import { ChatApiError } from "./messageOperations.server";

export function errorResponse(
    code: string,
    message: string,
    status: number,
    details?: unknown,
    headers?: HeadersInit
) {
    return NextResponse.json(
        { success: false, error: { code, message, ...(details ? { details } : {}) } },
        { status, headers }
    );
}

const UNAUTHENTICATED_CODES = ["NO_TOKEN", "TOKEN_EXPIRED", "INVALID_TOKEN", "USER_NOT_FOUND"];

/** The signed-in user, or the 401/403/500 response to return instead. */
export async function requireUser(): Promise<
    { user: userType; response?: undefined } | { user?: undefined; response: NextResponse }
> {
    const { error, user } = await authorization();
    if (error || !user) {
        const code = error?.code ?? "NO_TOKEN";
        const status = UNAUTHENTICATED_CODES.includes(code) ? 401 : code === "SERVER_ERROR" ? 500 : 403;
        return { response: errorResponse(code, error?.message ?? "You're not logged in.", status) };
    }
    return { user };
}

/** The JSON body of the request, validated against `schema`, or the 400 response to return instead. */
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
        return {
            response: errorResponse(
                "VALIDATION_ERROR",
                "Invalid payload provided",
                400,
                z.flattenError(validation.error).fieldErrors
            ),
        };
    }
    return { data: validation.data };
}

/** Known chat errors keep their code/status; anything else is logged and becomes a generic 500. */
export function handleRouteError(error: unknown, logLabel: string, fallbackMessage: string) {
    if (error instanceof ChatApiError) {
        return errorResponse(error.code, error.message, error.status);
    }
    console.error(`${logLabel}:`, error);
    return errorResponse("SERVER_ERROR", fallbackMessage, 500);
}
