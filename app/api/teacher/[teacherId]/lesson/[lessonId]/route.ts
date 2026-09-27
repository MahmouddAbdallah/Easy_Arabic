import { authorization } from "@/lib/verifyAuth";
import { db } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";


export async function PATCH(req: NextRequest, { params }: { params: Promise<{ teacherId: string, lessonId: string }> }) {
    try {
        const { error, user } = await authorization(["admin", "teacher"]);
        const { teacherId, lessonId } = await params;

        if (error || !user || (user.id != teacherId && user.role != 'admin')) {
            return NextResponse.json(
                { success: false, error: { code: "FORBIDDEN", message: "Forbidden" } },
                { status: 403 }
            );
        }

        const body = await req.json();
        const { ...updateData } = body;

        if (!lessonId) {
            return NextResponse.json(
                { success: false, error: { code: "BAD_REQUEST", message: "Lesson ID is required" } },
                { status: 400 }
            );
        }

        const existingLesson = await db.orm.public.Lesson.where({ id: lessonId }).first();

        if (!existingLesson) {
            return NextResponse.json(
                { success: false, error: { code: "NOT_FOUND", message: "Lesson not found" } },
                { status: 404 }
            );
        }

        if (user.role === "teacher") {
            const lessonTime = new Date(existingLesson.classDate.toString()).getTime();
            const currentTime = Date.now();

            const diffInDays = (currentTime - lessonTime) / (1000 * 60 * 60 * 24);

            if (diffInDays > 7) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: "LESSON_EXPIRED",
                            message: "Sorry, this lesson was scheduled more than 7 days ago and can no longer be modified."
                        }
                    },
                    { status: 400 }
                );
            }
        }

        const dataToUpdate: Record<string, any> = {};

        if (updateData.classDate !== undefined) {
            dataToUpdate.classDate = new Date(body.classDate).toISOString();
        }

        if (updateData.duration !== undefined) dataToUpdate.duration = updateData.duration;
        if (updateData.TeacherReward !== undefined) dataToUpdate.TeacherReward = updateData.TeacherReward;
        if (updateData.status !== undefined) dataToUpdate.status = updateData.status;
        if (updateData.student !== undefined) dataToUpdate.student = updateData.student;
        if (updateData.familyId !== undefined) dataToUpdate.familyId = updateData.familyId;

        const updatedLesson = await db.orm.public.Lesson.where({ id: lessonId }).update(dataToUpdate);

        return NextResponse.json({ lesson: updatedLesson }, { status: 200 });

    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { success: false, error: { code: "SERVER_ERROR", message: "Error updating lesson" } },
            { status: 500 }
        );
    }
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ teacherId: string, lessonId: string }> }) {
    try {
        const { error, user } = await authorization(["admin", "teacher"]);
        const { teacherId, lessonId } = await params;

        if (error || !user || (user.id != teacherId && user.role != 'admin')) {
            return NextResponse.json(
                { success: false, error: { code: "FORBIDDEN", message: "Forbidden" } },
                { status: 403 }
            );
        }

        if (!lessonId) {
            return NextResponse.json(
                { success: false, error: { code: "BAD_REQUEST", message: "Lesson ID is required" } },
                { status: 400 }
            );
        }

        const existingLesson = await db.orm.public.Lesson.where({ id: lessonId }).first();

        if (!existingLesson) {
            return NextResponse.json(
                { success: false, error: { code: "NOT_FOUND", message: "Lesson not found" } },
                { status: 404 }
            );
        }

        if (user.role === "teacher") {
            const lessonTime = new Date(existingLesson.classDate.toString()).getTime();
            const currentTime = Date.now();

            const diffInDays = (currentTime - lessonTime) / (1000 * 60 * 60 * 24);

            if (diffInDays > 7) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: "LESSON_EXPIRED",
                            message: "Sorry, this lesson was scheduled more than 7 days ago and cannot be deleted."
                        }
                    },
                    { status: 400 }
                );
            }
        }

        await db.orm.public.Lesson.where({ id: lessonId }).delete();

        return NextResponse.json(
            { success: true, message: "Lesson deleted successfully" },
            { status: 200 }
        );

    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { success: false, error: { code: "SERVER_ERROR", message: "Error deleting lesson" } },
            { status: 500 }
        );
    }
}