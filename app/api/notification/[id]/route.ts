import { verifyAuth } from "@/lib/verifyAuth";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/client";
import { Params } from "next/dist/shared/lib/router/utils/route-matcher";

export async function DELETE(req: NextRequest, { params }: { params: Params }) {
    try {
        const verify = await verifyAuth();
        if (verify) {
            if (verify.role == 'admin') {
                const { id } = params;
                await prisma.notification.delete({ where: { id } });
                return NextResponse.json({ message: 'Delete notification successfully!!' }, { status: 200 });
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