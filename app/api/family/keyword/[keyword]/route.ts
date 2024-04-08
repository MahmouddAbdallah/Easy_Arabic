import prisma from "@/prisma/client";
import { Params } from "next/dist/shared/lib/router/utils/route-matcher";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Params }) {
    try {
        const { keyword } = params;
        if (keyword) {
            const data = await prisma.family.findMany({
                where: {
                    OR: [
                        { name: { contains: keyword, mode: 'insensitive' } },
                        // { email: { contains: keyword, mode: 'insensitive' } },
                    ],
                },
            })
            if (data) {
                return NextResponse.json({ data, message: 'successfully' }, { status: 200 });
            } else {
                return NextResponse.json({ message: 'there is no family name ' }, { status: 400 });
            }
        } else {
            return NextResponse.json({ message: 'There is no  keyword provided' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Error in server' }, { status: 400 })
    }
}