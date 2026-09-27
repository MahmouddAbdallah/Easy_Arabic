import { NextResponse, NextRequest } from "next/server";
import bcrypt from "bcrypt";
import { db } from "@/prisma/db";
import { firstValidationMessage, userSchema } from "@/lib/validation";

interface RouteParams {
    params: Promise<{ userId: string }>;
}

// ----------------------------------------------------------------------
// 1. UPDATE USER (PUT)
// ----------------------------------------------------------------------
export async function PUT(req: NextRequest, { params }: RouteParams) {
    try {
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
        const { userId } = await params;

        const user = await db.orm.public.User.where({ id: userId }).first();
        if (!user) {
            return NextResponse.json(
                { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { success: true, user: user },
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