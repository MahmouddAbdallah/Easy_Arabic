import { verifyAuth } from "@/lib/verifyAuth";
import { Params } from "next/dist/shared/lib/router/utils/route-matcher";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/client";
import bcrypt from 'bcrypt'

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
    try {
        const { id } = params
        const body = await req.json()
        const verify = await verifyAuth();
        if (verify) {
            if (verify.role == 'admin') {
                const user = await prisma.user.findUnique({ where: { id: id }, select: { password: true } })
                if (user) {
                    const isMatch = await bcrypt.compare(body.password, user?.password)
                    if (!isMatch) return NextResponse.json({ message: "Incorrect Password" }, { status: 400 })
                    await prisma.user.update({
                        where: { id: id },
                        data: { password: await bcrypt.hash(body.newPassword, 10) as string }
                    })
                    return NextResponse.json({ message: 'Changed password' }, { status: 200 });
                }
                else {
                    return NextResponse.json({ message: 'In valid user' }, { status: 400 });
                }
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