import { firstValidationMessage } from "@/lib/validation";
import { authorization } from "@/lib/verifyAuth";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { forbidden, serverError, validationError } from "./responses";

/**
 * The shape every route under /api/notification shares, written once: the caller must be signed in,
 * the JSON body (when there is one) must match its schema, and anything unexpected becomes a 500 instead
 * of an unhandled error. A handler only contains what is specific to its endpoint, and it can rely on:
 *
 *   - `user` always coming from the session, never from the request — nobody can act as someone else;
 *   - `body` being already validated and typed by its schema (malformed JSON counts as invalid input).
 */

export type SessionUser = NonNullable<Awaited<ReturnType<typeof authorization>>["user"]>;

/** A route for signed-in users that takes no body. */
export function authedRoute(handler: (user: SessionUser, req: NextRequest) => Promise<Response>) {
    return async (req: NextRequest): Promise<Response> => {
        try {
            const { user } = await authorization();
            if (!user) return forbidden();

            return await handler(user, req);
        } catch (error) {
            return serverError(error);
        }
    };
}

/** A route for signed-in users whose JSON body must match `schema`. */
export function authedJsonRoute<S extends z.ZodType>(
    schema: S,
    handler: (user: SessionUser, body: z.output<S>) => Promise<Response>
) {
    return authedRoute(async (user, req) => {
        const validation = schema.safeParse(await req.json().catch(() => null));
        if (!validation.success) return validationError(firstValidationMessage(validation.error));

        return handler(user, validation.data);
    });
}
