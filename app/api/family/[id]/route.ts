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
        const teacher = await prisma.family.update({
            where: {
                id
            }, data: {
                name: body.name,
                email: body.email,
                phone: body.phone,
                role: body.role,
            }
        })
        return NextResponse.json({ user: teacher, message: 'Successfully updated' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Error in server' })
    }
}