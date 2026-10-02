import { authorization } from "@/lib/verifyAuth";
import { db } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ teacherId: string, familyId: string }> }) {
    try {
        const { error } = await authorization(["admin"]);
        const { teacherId, familyId } = await params;

        if (error) {
            return NextResponse.json(
                { success: false, error: { code: "FORBIDDEN", message: "Forbidden" } },
                { status: 403 }
            );
        }

        await db.orm.public.TeacherFamily.where({
            teacherId,
            familyId
        }).delete();

        return NextResponse.json({ success: true, message: "Family deleted successfully" }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', message: 'Error in server' } },
            { status: 500 }
        );
    }
}