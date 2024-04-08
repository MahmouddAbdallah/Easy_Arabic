import { NextResponse, NextRequest } from "next/server";
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from "@/prisma/client";
import { z } from "zod";
import { Params } from "next/dist/shared/lib/router/utils/route-matcher";

interface bodyInterface {
    name: string,
    email: string,
    phone: string,
    password: string,
    role: string
}

const userVaild = z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    password: z.string(),
})

export async function POST(req: NextRequest, { params }: { params: Params }) {
    try {
        const { role } = params
        const body: bodyInterface = await req.json();
        const vaildation = userVaild.safeParse(body);
        if (!vaildation.success) return NextResponse.json(vaildation.error.errors[0], { status: 400 });
        if (role == 'teacher') {
            const user = await prisma.user.findUnique({ where: { email: vaildation.data.email } })
            if (user) return NextResponse.json({ message: "This user has already here, please sign in" }, { status: 400 })
            else {
                await prisma.user.create({
                    data: {
                        name: vaildation.data.name,
                        email: vaildation.data.email,
                        phone: vaildation.data.phone,
                        password: await bcrypt.hash(vaildation.data.password, 10) as string,
                    },
                })
                return NextResponse.json({ message: 'Sign up successfully!!', status: 201 })
            }
        } else if (role == 'family') {
            const family = await prisma.family.findUnique({ where: { email: vaildation.data.email } })
            if (family) return NextResponse.json({ message: "This family has already here, please sign in" }, { status: 400 })
            else {
                await prisma.family.create({
                    data: {
                        name: vaildation.data.name,
                        email: vaildation.data.email,
                        phone: vaildation.data.phone,
                        password: await bcrypt.hash(vaildation.data.password, 10) as string,
                    },
                })
                return NextResponse.json({ message: 'Sign up successfully!!', status: 201 })
            }
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Error in server' }, { status: 400 })
    }
}