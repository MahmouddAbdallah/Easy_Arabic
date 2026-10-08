import { NextResponse, NextRequest, after } from "next/server";
import { adminPasswordResetSchema, firstValidationMessage } from "@/lib/validation";
import { authorization } from "@/lib/verifyAuth";
import { hashPassword } from "@/lib/auth/password";
import { sendPasswordChangedEmail } from "@/lib/auth/email";
import { forbiddenOrigin, invalidBody, isSameOrigin, readJsonBody } from "@/lib/auth/request";
import { apiError } from "@/lib/apiResponse";
import { db } from "@/prisma/db";

interface RouteParams {
    params: Promise<{ userId: string }>;
}

// ----------------------------------------------------------------------
// ADMIN SETS A USER'S PASSWORD (POST)
//
// No current password is needed: this is for an admin helping someone who is locked out.
// Same building blocks as /api/auth/change-password: hashPassword for the hash, and moving
// `passwordLastChanged`, which is what signs the user out of every device (see
// lib/verifyAuth.ts: a token issued before that instant is rejected).
// ----------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: RouteParams) {
    try {
        if (!isSameOrigin(req)) return forbiddenOrigin();

        // Enforced here on the server; the dashboard UI is not what protects this route.
        const { error, user: admin } = await authorization(["admin"]);
        if (error) return apiError(error.code === "INSUFFICIENT_PERMISSIONS" ? 403 : 401, "FORBIDDEN", "Forbidden");

        const { userId } = await params;

        // Changing your own password this way would sign this very session out.
        if (admin?.id === userId) {
            return apiError(400, "VALIDATION_ERROR", "To change your own password, use the Change Password page");
        }

        const body = await readJsonBody(req);
        if (body === null) return invalidBody();
        const validation = adminPasswordResetSchema.safeParse(body);
        if (!validation.success) {
            return apiError(400, "VALIDATION_ERROR", firstValidationMessage(validation.error));
        }

        const user = await db.orm.public.User.where({ id: userId }).select("id", "email").first();
        if (!user) return apiError(404, "NOT_FOUND", "User not found");

        const now = new Date().toISOString();
        const passwordHash = await hashPassword(validation.data.newPassword);
        await db.transaction(async (tx) => {
            await tx.orm.public.User.where({ id: user.id }).update({
                password: passwordHash,
                passwordLastChanged: now, // invalidates every session issued before now
                updatedAt: now,
            });
            // A reset link emailed earlier must not be able to override the password set here.
            await tx.orm.public.AuthToken.where({ userId: user.id, type: "password_reset" }).delete();
        });

        after(() => sendPasswordChangedEmail(user.email));

        return NextResponse.json(
            { success: true, message: "Password updated. The user was signed out on all devices." },
            { status: 200 }
        );
    } catch (error) {
        console.error("admin reset-password failed:", error instanceof Error ? error.message : error);
        return apiError(500, "SERVER_ERROR", "Error in server");
    }
}
