import { firstValidationMessage, moneyPerLessonSchema } from "@/lib/validation";
import { authorization } from "@/lib/verifyAuth";
import { db } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ teacherId: string }> }) {
    try {
        const { error } = await authorization(["admin",]);
        if (error) {
            return NextResponse.json(
                { success: false, error: { code: "FORBIDDEN", message: "Forbidden" } },
                { status: 403 }
            );
        }
        const { teacherId } = await params;
        const body = await req.json();
        const validation = moneyPerLessonSchema.safeParse({ ...body, teacherId });
        if (!validation.success) {
            return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: firstValidationMessage(validation.error) } }, { status: 400 });
        }
        const { data } = validation
        const money = await db.orm.public.MoneyPerLesson.upsert({
            create: {
                money: data.money,
                teacherId: data.teacherId
            },
            update: {
                money: data.money,
            },
            conflictOn: {
                teacherId: data.teacherId
            }
        })

        return NextResponse.json({ money: money }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Error in server' } }, { status: 500 });
    }
}
export async function GET(req: NextRequest, { params }: { params: Promise<{ teacherId: string }> }) {
    try {
        const { error } = await authorization(["admin", 'teacher']);
        if (error) {
            return NextResponse.json(
                { success: false, error: { code: "FORBIDDEN", message: "Forbidden" } },
                { status: 403 }
            );
        }
        const { teacherId } = await params;

        const money = await db.orm.public.MoneyPerLesson.where({
            teacherId
        }).first();

        return NextResponse.json({ money: money ?? { id: null, money: 0 } }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Error in server' } }, { status: 500 });
    }
}
