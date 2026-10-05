import { NextResponse, NextRequest } from "next/server";
import bcrypt from "bcrypt";
import { db } from "@/prisma/db";
import { firstValidationMessage, userSchema } from "@/lib/validation";
import { authorization } from "@/lib/verifyAuth";
import { apiError } from "@/lib/apiResponse";

interface RouteParams {
    params: Promise<{ userId: string }>;
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

        const validation = userSchema.partial().safeParse(body);
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

        if (data.password) {
            data.password = await bcrypt.hash(data.password, 10);
        }

        const updatedUser = await db.orm.public.User.where({ id: userId }).update(data);
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
        const { error } = await authorization(["admin"]);
        if (error) return apiError(error.code === "INSUFFICIENT_PERMISSIONS" ? 403 : 401, "FORBIDDEN", "Forbidden");

        const { userId } = await params;

        const existingUser = await db.orm.public.User.where({ id: userId }).first();
        if (!existingUser) {
            return NextResponse.json(
                { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
                { status: 404 }
            );
        }

        await db.orm.public.User.where({ id: userId }).delete();

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