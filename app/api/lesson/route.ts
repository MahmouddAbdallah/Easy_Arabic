import { verifyAuth } from "@/lib/verifyAuth";
import prisma from "@/prisma/client";
import { NextRequest, NextResponse } from "next/server";

interface LessonInterface {
    familyId: string,
    student: string,
    status: string,
    classDate: string,
    month: string,
    duration: string,
    TeacherReward: string,
}

export async function POST(req: NextRequest) {
    try {
        const body: LessonInterface = await req.json();
        const verify = await verifyAuth();
        if (verify) {
            const newLesson = await prisma.lesson.create({
                data: {
                    userId: verify.id,
                    familyId: body.familyId,
                    student: body.student,
                    status: body.status,
                    classDate: body.classDate,
                    money: (100 / 60) * parseInt(body.duration),
                    duration: parseInt(body.duration),
                    TeacherReward: body.TeacherReward
                },
            })
            return NextResponse.json({ lesson: newLesson, message: 'Successfully create lesson' });
        } else {
            return NextResponse.json({ message: 'fail' });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Error in server' })
    }
}