import { Params } from "next/dist/shared/lib/router/utils/route-matcher";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/client";
import { verifyAuth } from "@/lib/verifyAuth";


interface LessonInterface {
    familyId: string,
    student: string,
    status: string,
    classDate: string,
    month: string,
    duration: string,
    TeacherReward: string,
}

export async function PUT(req: NextRequest, { params }: { params: Params }) {
    try {
        const { id } = params
        const body: LessonInterface = await req.json();
        const verify = await verifyAuth();
        if (verify) {
            if (verify.role == 'teacher' || verify.role == 'admin') {
                const newLesson = await prisma.lesson.update({
                    where: { id: id },
                    data: {
                        familyId: body.familyId,
                        student: body.student,
                        status: body.status,
                        classDate: body.classDate,
                        money: (100 / 60) * parseInt(body.duration),
                        duration: parseInt(body.duration),
                        TeacherReward: body.TeacherReward,
                        updatedAt: new Date()
                    }
                })
                return NextResponse.json({ lesson: newLesson, message: 'Successfully updated' }, { status: 200 });
            } else {
                return NextResponse.json({ message: 'Not allow' }, { status: 400 });
            }
        } else {
            return NextResponse.json({ message: 'fail' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Error in server' }, { status: 400 })
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Params }) {
    try {
        const { id } = params
        const verify = await verifyAuth();
        if (verify) {
            const newLesson = await prisma.lesson.delete({
                where: { id: id }
            })
            return NextResponse.json({ lesson: newLesson, message: 'Successfully deleted' }, { status: 200 });
        } else {
            return NextResponse.json({ message: 'fail' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Error in server' }, { status: 400 })
    }
}