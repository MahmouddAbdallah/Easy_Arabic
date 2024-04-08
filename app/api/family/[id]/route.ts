import prisma from "@/prisma/client";
import { Params } from "next/dist/shared/lib/router/utils/route-matcher";
import { NextResponse, NextRequest } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Params }) {
    try {
        const { id } = params;
        const family = await prisma.family.findUnique({
            where: {
                id
            }, select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true
            }
        })
        return NextResponse.json({ user: family, message: 'success' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Error in server' })
    }
}
export async function PUT(req: NextRequest, { params }: { params: Params }) {
    try {
        const { id } = params;
        const body = await req.json();
        const family = await prisma.family.update({
            where: {
                id
            }, data: {
                name: body.name,
                email: body.email,
                phone: body.phone,
                role: body.role,
            }
        })
        return NextResponse.json({ user: family, message: 'Successfully updated' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Error in server' })
    }
}
export async function DELETE(req: NextRequest, { params }: { params: Params }) {
    try {
        const { id } = params;
        const lessons = await prisma.lesson.findMany({
            where: {
                familyId: id,
            }, select: {
                id: true
            }
        });

        // Delete all related lessons
        const deleteLessonPromises = lessons.map(lesson =>
            prisma.lesson.delete({
                where: {
                    id: lesson.id,
                },
            })
        );

        await Promise.all(deleteLessonPromises);
        await prisma.family.delete({
            where: {
                id
            }
        })
        return NextResponse.json({ message: 'Successfully deleted profile...' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Error in server' }, { status: 400 })
    }
}
/*
        const url = new URL(req.url);
        const searchParams = new URLSearchParams(url.search)
        const select = searchParams.get("select");
        const obj: { [key: string]: boolean } = {};
        select?.split(',').forEach((element) => {
            if (element in obj) return;
            else obj[element] = true;
        })
        console.log(obj);
*/