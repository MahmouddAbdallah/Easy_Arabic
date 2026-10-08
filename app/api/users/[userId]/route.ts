import { NextResponse, NextRequest } from "next/server";
import { db } from "@/prisma/db";
import { firstValidationMessage, userUpdateSchema } from "@/lib/validation";
import { authorization } from "@/lib/verifyAuth";
import { apiError, isUniqueViolation } from "@/lib/apiResponse";
import { findUserByEmail } from "@/lib/auth/users";

interface RouteParams {
    params: Promise<{ userId: string }>;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Removes the user together with every row in this app's Postgres that belongs to them.
 *
 * The ORM's `where().delete()` removes a single row (see lib/profile/service.ts), so the
 * multi-row cleanups are raw SQL, in one transaction. Children go first, the user last, so no
 * foreign key ever sees a dangling reference. Everything is scoped to `userId`; rows that
 * belong to OTHER users are never deleted:
 *
 *   - lesson / teacherFamily: no ON DELETE rule (they block the delete) and the user can be on
 *     either side, so a row is removed when the user is its teacher OR its family. A lesson is
 *     a single record shared by that pair, so it cannot survive with one side missing.
 *   - moneyPerLesson: the teacher's hourly rate (teacher side only).
 *   - profileChangeRequest: the user's own requests are deleted; requests they only REVIEWED
 *     as an admin belong to other families, so those are kept and just lose the reviewer id.
 *   - authToken / userFCMToken: owned by the user (the FKs cascade as well, this just makes the
 *     cleanup independent of the database's cascade setup).
 *
 * Firebase (Auth, Firestore, FCM, ...) is deliberately not touched here.
 */
async function deleteUserAndOwnedData(tx: Tx, userId: string) {
    await tx.execute(db.raw.sql`DELETE FROM "lesson" WHERE "teacherId" = ${userId} OR "familyId" = ${userId}`.affectedCount().build());
    await tx.execute(db.raw.sql`DELETE FROM "teacherFamily" WHERE "teacherId" = ${userId} OR "familyId" = ${userId}`.affectedCount().build());
    await tx.execute(db.raw.sql`DELETE FROM "moneyPerLesson" WHERE "teacherId" = ${userId}`.affectedCount().build());
    await tx.execute(db.raw.sql`UPDATE "profileChangeRequest" SET "reviewedById" = NULL WHERE "reviewedById" = ${userId}`.affectedCount().build());
    await tx.execute(db.raw.sql`DELETE FROM "profileChangeRequest" WHERE "familyId" = ${userId}`.affectedCount().build());
    await tx.execute(db.raw.sql`DELETE FROM "authToken" WHERE "userId" = ${userId}`.affectedCount().build());
    await tx.execute(db.raw.sql`DELETE FROM "userFCMToken" WHERE "userId" = ${userId}`.affectedCount().build());
    await tx.orm.public.User.where({ id: userId }).delete();
}

// ----------------------------------------------------------------------
// 1. UPDATE USER (PUT)
// ----------------------------------------------------------------------
export async function PUT(req: NextRequest, { params }: RouteParams) {
    try {
        // Admin only. This route can change ANY field of ANY user (role, status, email, phone...),
        // so it must never be reachable by customers or anonymous callers. Customers edit their own
        // profile through /api/profile instead.
        const { error } = await authorization(["admin"]);
        if (error) return apiError(error.code === "INSUFFICIENT_PERMISSIONS" ? 403 : 401, "FORBIDDEN", "Forbidden");

        const { userId } = await params;
        const body = await req.json();

        const existingUser = await db.orm.public.User.where({ id: userId }).first();
        if (!existingUser) {
            return NextResponse.json(
                { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
                { status: 404 }
            );
        }

        // `userUpdateSchema`, not `userSchema.partial()`: the latter keeps the `.default()`s, so an
        // edit that only sent `{ name }` would silently reset role -> "family" and status -> "active".
        // `password` is left out on purpose: passwords change only through
        // POST /api/users/[userId]/reset-password, which also invalidates the user's sessions.
        const validation = userUpdateSchema.omit({ password: true }).safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstValidationMessage(validation.error),
                    },
                },
                { status: 400 }
            );
        }

        const data = validation.data;

        // Same uniqueness rules as POST /api/users, but ignoring the user being edited.
        if (data.email) {
            const emailOwner = await findUserByEmail(data.email);
            if (emailOwner && emailOwner.id !== userId) {
                return apiError(409, "CONFLICT", "This email address already belongs to another account");
            }
        }
        if (data.phone) {
            const phoneOwner = await db.orm.public.User.where({ phone: data.phone }).first();
            if (phoneOwner && phoneOwner.id !== userId) {
                return apiError(409, "CONFLICT", "This phone number already belongs to another account");
            }
        }

        let updatedUser;
        try {
            updatedUser = await db.orm.public.User.where({ id: userId }).update({
                ...data,
                updatedAt: new Date().toISOString(),
            });
        } catch (updateError) {
            // Two edits racing for the same email trip the unique constraint.
            if (isUniqueViolation(updateError)) {
                return apiError(409, "CONFLICT", "This email address already belongs to another account");
            }
            throw updateError;
        }
        if (updatedUser) {
            delete (updatedUser as { password?: string }).password;
        }
        return NextResponse.json(
            { success: true, message: "User updated successfully", user: updatedUser },
            { status: 200 }
        );
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { success: false, error: { code: "SERVER_ERROR", message: "Error in server" } },
            { status: 500 }
        );
    }
}

// ----------------------------------------------------------------------
// 2. DELETE USER (DELETE)
// ----------------------------------------------------------------------
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    try {
        const { error, user: admin } = await authorization(["admin"]);
        if (error) return apiError(error.code === "INSUFFICIENT_PERMISSIONS" ? 403 : 401, "FORBIDDEN", "Forbidden");

        const { userId } = await params;

        // An admin who deletes their own account would lock themselves out of the dashboard.
        if (admin?.id === userId) {
            return apiError(400, "VALIDATION_ERROR", "You can't delete your own account");
        }

        const existingUser = await db.orm.public.User.where({ id: userId }).first();
        if (!existingUser) {
            return NextResponse.json(
                { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
                { status: 404 }
            );
        }

        // All or nothing: if any step fails the whole delete rolls back and nothing is lost.
        await db.transaction((tx) => deleteUserAndOwnedData(tx, userId));

        return NextResponse.json(
            { success: true, message: "User deleted successfully" },
            { status: 200 }
        );
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { success: false, error: { code: "SERVER_ERROR", message: "Error in server" } },
            { status: 500 }
        );
    }
}
// ----------------------------------------------------------------------
// 2. FETCH USER (GET)
// ----------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        // Any signed-in user (the chat looks up the person you are talking to), nobody else.
        const { error } = await authorization();
        if (error) return apiError(error.code === "INSUFFICIENT_PERMISSIONS" ? 403 : 401, "UNAUTHENTICATED", "Please sign in.");

        const { userId } = await params;

        const found = await db.orm.public.User.where({ id: userId }).first();
        if (!found) {
            return NextResponse.json(
                { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
                { status: 404 }
            );
        }
        // Never send the password hash (or the password-change timestamp) to the browser.
        const user: Partial<typeof found> = { ...found };
        delete user.password;
        delete user.passwordLastChanged;

        return NextResponse.json(
            { success: true, user },
            { status: 200 }
        );
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { success: false, error: { code: "SERVER_ERROR", message: "Error in server" } },
            { status: 500 }
        );
    }
}