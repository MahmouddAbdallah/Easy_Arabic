import { NextResponse, NextRequest } from "next/server";
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from "@/prisma/client";
import { z } from "zod";
import { cookies } from 'next/headers'
import { Params } from "next/dist/shared/lib/router/utils/route-matcher";

interface bodyInterface {
    email: string,
    password: string,
}

const userVaild = z.object({
    email: z.string(),
    password: z.string()
})
export async function POST(req: NextRequest, { params }: { params: Params }) {
    try {
        const { role } = params
        const body: bodyInterface = await req.json();
        const vaildation = userVaild.safeParse(body);
        if (!vaildation.success) return NextResponse.json(vaildation.error.errors[0], { status: 400 });
        let user;
        if (role == 'teacher') {
            user = await prisma.user.findUnique({ where: { email: vaildation.data.email } })
        } else if (role == 'family') {
            user = await prisma.family.findUnique({ where: { email: vaildation.data.email } })
        }
        if (!user) return NextResponse.json({ message: "Invaild user, please sign Up" }, { status: 400 })
        else {
            const isMatch = await bcrypt.compare(vaildation.data.password, user.password)
            if (!isMatch) return NextResponse.json({ message: "Incorrect Password" }, { status: 400 })
            const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET as string)
            cookies()
                .set({
                    name: 'token',
                    value: token,
                    httpOnly: true,
                    maxAge: 5454512,
                })
            if (user) {
                delete (user as { password: unknown }).password;
            }
            await prisma.notification.create({
                data: {
                    userId: user.id,
                    isRead: false,
                    type: 'UpdateLesson'
                }
            })
            return NextResponse.json({ message: 'Sign In successfully!!', user, status: 200 })
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Error in server' }, { status: 400 })
    }
}