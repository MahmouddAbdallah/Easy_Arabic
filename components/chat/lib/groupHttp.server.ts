/**
 * SERVER ONLY. Helpers for the group route handlers (app/api/chat/groups/*), on top of ./http.server.ts. Route
 * files can't export helpers, so they live here.
 */
import { z } from "zod";
import { errorResponse, handleRouteError } from "./http.server";
import { InvalidGroupMembersError } from "./groupOperations.server";

/**
 * The JSON body of the request, validated against `schema`, or the 400 response to return instead. Unlike the
 * generic helper, the message is the first thing that is wrong, in words (the form says the same words), so the
 * person is told "Give the group a name." and not "Invalid payload provided".
 */
export async function parseGroupBody<S extends z.ZodType>(
    req: Request,
    schema: S
): Promise<{ data: z.output<S>; response?: undefined } | { data?: undefined; response: ReturnType<typeof errorResponse> }> {
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
                validation.error.issues[0]?.message ?? "Invalid payload provided",
                400,
                z.flattenError(validation.error).fieldErrors
            ),
        };
    }
    return { data: validation.data };
}

/** Errors of the group endpoints: the people who can't be added are named, everything else as in the rest of the chat. */
export function groupErrorResponse(error: unknown, logLabel: string, fallbackMessage: string) {
    if (error instanceof InvalidGroupMembersError) {
        return errorResponse(error.code, error.message, error.status, { memberIds: error.memberIds });
    }
    return handleRouteError(error, logLabel, fallbackMessage);
}
