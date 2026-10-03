import { setActiveContext } from "@/components/notification/lib/activeContext.server";
import { activeContextSchema } from "@/components/notification/lib/schema";
import { firstValidationMessage } from "@/lib/validation";
import { authorization } from "@/lib/verifyAuth";
import { NextRequest, NextResponse } from "next/server";
import { forbidden, serverError, validationError } from "../_lib/responses";

/**
 * Tells the server which page the signed-in user's browser tab is showing (`{ sessionId, link }`),
 * or that it no longer shows anything (`link: null`). sendNotification() uses it to skip users who
 * are already looking at the page a notification links to. The user always comes from the session,
 * never from the body, so nobody can silence another user's notifications.
 *
 * POST rather than PUT so the browser can also send it with `fetch(..., { keepalive: true })` while
 * the page is closing.
 */
export async function POST(req: NextRequest) {
    try {
        const { user } = await authorization();
        if (!user) return forbidden();

        const validation = activeContextSchema.safeParse(await req.json().catch(() => null));
        if (!validation.success) return validationError(firstValidationMessage(validation.error));

        const { sessionId, link } = validation.data;
        await setActiveContext(user.id, sessionId, link);

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        return serverError(error);
    }
}
