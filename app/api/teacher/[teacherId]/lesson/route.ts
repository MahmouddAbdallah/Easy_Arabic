import { firstValidationMessage, lessonSchema } from "@/lib/validation";
import { authorization } from "@/lib/verifyAuth";
import { db } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ teacherId: string }> }) {
    try {
        const { error } = await authorization(["admin", 'teacher']);

        if (error) {
            return NextResponse.json(
                { success: false, error: { code: "FORBIDDEN", message: "Forbidden" } },
                { status: 403 }
            );
        }

        const { teacherId } = await params;
        const body = await req.json();
        const validation = lessonSchema.safeParse({ ...body, teacherId });

        if (!validation.success) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: firstValidationMessage(validation.error) } },
                { status: 400 }
            );
        }

        const { data } = validation;

        const money = await db.orm.public.MoneyPerLesson.where({
            teacherId: data.teacherId
        }).first();

        const lesson = await db.orm.public.Lesson.create({
            familyId: data.familyId,
            classDate: new Date(data.classDate).toISOString(),
            duration: data.duration,
            money: money?.money ?? 0,
            status: data.status,
            student: data.student,
            teacherId: data.teacherId,
            TeacherReward: data.TeacherReward as any,
        });

        return NextResponse.json({ lesson }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', message: 'Error in server' } },
            { status: 500 }
        );
    }
}