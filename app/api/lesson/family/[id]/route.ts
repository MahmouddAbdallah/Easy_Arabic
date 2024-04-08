import { verifyAuth } from "@/lib/verifyAuth";
import prisma from "@/prisma/client";
import { Params } from "next/dist/shared/lib/router/utils/route-matcher";
import { NextRequest, NextResponse } from "next/server";


export async function GET(req: NextRequest, { params }: { params: Params }) {
    try {
        const { id } = params
        const lessons = await prisma.lesson.findMany({
            where: { familyId: id as string },
            select: {
                id: true,
                family: {
                    select: { name: true }
                },
                status: true,
                money: false,
                student: true,
                classDate: true,
                user: {
                    select: { name: true }
                },
                duration: true,
                TeacherReward: true,
                updatedAt: true,
                createdAt: true
            },
            orderBy: { classDate: 'desc' }
        })
        const lessonsByMonth: { [key: string]: any[] } = {};
        lessons.forEach(lesson => {
            const monthYear = lesson.classDate.toString().slice(0, 7); // Extracting year and month
            if (!lessonsByMonth[monthYear]) {
                lessonsByMonth[monthYear] = [];
            }
            lessonsByMonth[monthYear].push(lesson);
        });

        const tables = Object.entries(lessonsByMonth).map(([monthYear, lessons]) => {
            return {
                monthYear,
                lessons
            };
        });
        return NextResponse.json({ tables }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Error in server' }, { status: 400 })
    }
}