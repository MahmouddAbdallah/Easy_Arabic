import { NextRequest, NextResponse } from "next/server";
import { createGroupUploadTickets } from "@/components/chat/lib/groupOperations.server";
import { groupErrorResponse, parseGroupBody } from "@/components/chat/lib/groupHttp.server";
import { GroupUploadRequestSchema } from "@/components/chat/lib/groupSchemas";
import { rateLimitUser, requireUser } from "@/components/chat/lib/http.server";

// Signing uses the Cloudinary secret and Node's crypto.
export const runtime = "nodejs";

/** Signing is cheap but hands out upload rights, so it's throttled per user, like the uploads of a direct chat. */
const SIGN_LIMIT = { limit: 30, windowSeconds: 60 };

/**
 * POST: "I want to upload these files for this group". Answers, per file, with a signed Cloudinary ticket or the
 * reason it was refused (the same shape as /api/chat/attachments). `purpose: "photo"` is the picture of a group that
 * is about to be created; `purpose: "message"` is for files and voice messages sent to a group the user is in.
 * Removing an upload that was never used goes through DELETE /api/chat/attachments, as for a direct chat.
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireUser();
        if (auth.response) return auth.response;
        const { user } = auth;

        const limited = await rateLimitUser(
            "chat-upload",
            user.id,
            SIGN_LIMIT,
            "You're uploading too fast. Please wait a moment and try again."
        );
        if (limited) return limited;

        const parsed = await parseGroupBody(req, GroupUploadRequestSchema);
        if (parsed.response) return parsed.response;

        const results = await createGroupUploadTickets(user, parsed.data);
        return NextResponse.json({ success: true, results });
    } catch (error) {
        return groupErrorResponse(error, "Error creating group upload tickets", "An internal server error occurred while preparing the upload.");
    }
}
