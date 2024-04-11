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
            if (verify.role != 'admin') {
                const notification = await prisma.notification.create({
                    data: {
                        lessonId: newLesson.id,
                        userId: verify.id,
                        isRead: false,
                        type: 'Create new lesson'
                    }
                })
                if (!notification) {
                    await prisma.lesson.delete({ where: { id: newLesson.id } })
                }
            }

            return NextResponse.json({ lesson: newLesson, message: 'Successfully create lesson' }, { status: 201 });
        } else {
            return NextResponse.json({ message: 'fail' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Error in server' }, { status: 400 })
    }
}
