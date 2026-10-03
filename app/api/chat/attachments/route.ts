import { NextRequest, NextResponse } from "next/server";
import { consume, rateLimitKey } from "@/lib/auth/rateLimit";
import { getChatId } from "@/components/chat/lib/chatId";
import { createUploadTickets, destroyUploadedAssets, isUploadOf } from "@/components/chat/lib/attachments.server";
import { DeleteUploadRequestSchema, SignUploadsRequestSchema } from "@/components/chat/lib/schemas";
import { errorResponse, handleRouteError, parseBody, requireUser } from "@/components/chat/lib/http.server";

// Signing and clean-up use the Cloudinary secret and Node's crypto.
export const runtime = "nodejs";

/** Signing is cheap but hands out upload rights, so it's throttled per user. One call covers a whole selection. */
const SIGN_LIMIT = { limit: 30, windowSeconds: 60 };

/**
 * POST: "I want to upload these files to the chat with `receiverId`". The server validates each file
 * (type, size, count) and answers, per file, with either a signed Cloudinary upload ticket or the
 * reason it was refused. The files themselves go from the browser straight to Cloudinary.
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireUser();
        if (auth.response) return auth.response;
        const { user } = auth;

        const { allowed, retryAfterSeconds } = await consume(rateLimitKey("chat-upload", user.id), SIGN_LIMIT);
        if (!allowed) {
            return errorResponse(
                "RATE_LIMITED",
                "You're uploading too fast. Please wait a moment and try again.",
                429,
                undefined,
                { "Retry-After": String(Math.max(retryAfterSeconds, 1)) }
            );
        }

        const parsed = await parseBody(req, SignUploadsRequestSchema);
        if (parsed.response) return parsed.response;

        const { receiverId, files } = parsed.data;
        const results = createUploadTickets(user.id, getChatId(user.id, receiverId), files);

        return NextResponse.json({ success: true, results });
    } catch (error) {
        return handleRouteError(
            error,
            "Error creating chat upload tickets",
            "An internal server error occurred while preparing the upload."
        );
    }
}

/**
 * DELETE: removes a file that was uploaded but never sent (the user took it off the message before
 * sending, or left the chat). Only the uploader's own files can be removed.
 */
export async function DELETE(req: NextRequest) {
    try {
        const auth = await requireUser();
        if (auth.response) return auth.response;

        const parsed = await parseBody(req, DeleteUploadRequestSchema);
        if (parsed.response) return parsed.response;

        const { publicId, resourceType } = parsed.data;
        if (!isUploadOf(publicId, auth.user.id)) {
            return errorResponse("NOT_YOUR_UPLOAD", "You can only remove your own uploads.", 403);
        }

        await destroyUploadedAssets([{ publicId, resourceType }]);
        return NextResponse.json({ success: true });
    } catch (error) {
        return handleRouteError(
            error,
            "Error removing a chat upload",
            "An internal server error occurred while removing the file."
        );
    }
}
